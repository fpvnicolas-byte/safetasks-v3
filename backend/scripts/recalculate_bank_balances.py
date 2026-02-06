#!/usr/bin/env python3
"""
Recalculate bank account balances from applied transactions.

Why this exists
---------------
`bank_accounts.balance_cents` is maintained incrementally when transactions are created/approved.
Historical Stripe Connect invoice payments created `transactions` records directly (without applying
the corresponding balance change), which can leave balances out of sync.

This script recomputes balances as:
  sum(income.amount_cents) - sum(expense.amount_cents)
for transactions whose `payment_status` is in ("approved", "paid").

Usage
-----
  python backend/scripts/recalculate_bank_balances.py
  python backend/scripts/recalculate_bank_balances.py --organization-id <uuid>
  python backend/scripts/recalculate_bank_balances.py --dry-run
"""

import argparse
import asyncio
import sys
from pathlib import Path
from uuid import UUID

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import case, func, select

from app.db.session import SessionLocal
from app.models.bank_accounts import BankAccount
from app.models.transactions import Transaction


APPLIED_PAYMENT_STATUSES = ("approved", "paid")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Recalculate bank account balances from transactions")
    parser.add_argument(
        "--organization-id",
        type=UUID,
        default=None,
        help="Only recalculate balances for this organization",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print changes without writing to the database",
    )
    return parser.parse_args()


async def _main() -> int:
    args = _parse_args()

    async with SessionLocal() as db:
        accounts_query = select(BankAccount)
        if args.organization_id:
            accounts_query = accounts_query.where(BankAccount.organization_id == args.organization_id)

        accounts_result = await db.execute(accounts_query)
        accounts = accounts_result.scalars().all()

        signed_amount_cents = case(
            (Transaction.type == "income", Transaction.amount_cents),
            else_=-Transaction.amount_cents,
        )
        computed_balance_cents = func.coalesce(func.sum(signed_amount_cents), 0).label("balance_cents")

        balances_query = select(Transaction.bank_account_id, computed_balance_cents).where(
            Transaction.payment_status.in_(APPLIED_PAYMENT_STATUSES)
        )
        if args.organization_id:
            balances_query = balances_query.where(Transaction.organization_id == args.organization_id)
        balances_query = balances_query.group_by(Transaction.bank_account_id)

        balances_result = await db.execute(balances_query)
        computed_by_account_id = {
            row.bank_account_id: int(row.balance_cents or 0) for row in balances_result.all()
        }

        changed = 0
        for account in accounts:
            new_balance = computed_by_account_id.get(account.id, 0)
            if account.balance_cents != new_balance:
                print(f" - [{account.organization_id}] {account.name} ({account.id}): {account.balance_cents} -> {new_balance}")
                changed += 1
                if not args.dry_run:
                    account.balance_cents = new_balance
                    db.add(account)

        if args.dry_run:
            await db.rollback()
            print(f"\nDry run: {changed}/{len(accounts)} bank accounts would be updated.")
            return 0

        await db.commit()
        print(f"\nDone: updated {changed}/{len(accounts)} bank accounts.")
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))

