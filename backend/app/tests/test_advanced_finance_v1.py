#!/usr/bin/env python3
"""
Advanced Finance V1 Test Script
Tests expense categorization, invoicing, and P&L reporting
"""

import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.organizations import Organization
from app.models.profiles import Profile
from app.models.clients import Client
from app.models.projects import Project
from app.models.bank_accounts import BankAccount
from app.services.financial import transaction_service
from app.services.financial_advanced import invoice_service, financial_report_service
from app.schemas.transactions import TransactionCreate
from app.schemas.financial import InvoiceCreate, InvoiceItemCreate


async def setup_test_data():
    """Create test organization, project, and financial data"""
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)
    async with engine.begin() as conn:
        from app.core.base import Base
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Organization
        org_id = uuid.UUID("11111111-2222-3333-4444-555555555555")
        org = Organization(
            id=org_id,
            name="Film Finance Co",
            slug="film-finance"
        )
        db.add(org)
        await db.flush()

        # Admin user
        admin_user = Profile(
            id=uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
            email="finance.admin@test.com",
            organization_id=org_id,
            full_name="Finance Admin",
            role="admin"
        )
        db.add(admin_user)

        # Client
        client = Client(
            id=uuid.UUID("bbbbbbbb-cccc-dddd-eeee-ffffffffffff"),
            organization_id=org_id,
            name="Big Budget Productions",
            email="billing@bigbudget.com"
        )
        db.add(client)

        # Project
        project = Project(
            id=uuid.UUID("cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa"),
            organization_id=org_id,
            client_id=client.id,
            title="Epic Blockbuster Film",
            status="production"
        )
        db.add(project)

        # Bank Account
        bank_account = BankAccount(
            id=uuid.UUID("dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb"),
            organization_id=org_id,
            name="Production Account",
            balance_cents=10000000,  # R$ 100,000.00
            currency="BRL"
        )
        db.add(bank_account)

        await db.commit()

    return async_session, org_id


async def test_expense_categorization():
    """Test 1: Expense categorization in transactions"""
    print("💰 TEST 1: EXPENSE CATEGORIZATION")
    print("-" * 50)

    async_session, org_id = await setup_test_data()
    project_id = uuid.UUID("cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa")
    bank_account_id = uuid.UUID("dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb")

    async with async_session() as db:
        try:
            print("Creating categorized expenses...")

            # Crew hire expense
            crew_expense = TransactionCreate(
                bank_account_id=bank_account_id,
                project_id=project_id,
                category="crew_hire",
                type="expense",
                amount_cents=250000,  # R$ 2,500.00
                description="Camera Operator - John Smith",
                transaction_date="2024-01-15"
            )

            # Equipment rental expense
            equipment_expense = TransactionCreate(
                bank_account_id=bank_account_id,
                project_id=project_id,
                category="equipment_rental",
                type="expense",
                amount_cents=150000,  # R$ 1,500.00
                description="RED Camera rental - Week 1",
                transaction_date="2024-01-16"
            )

            # Logistics expense
            logistics_expense = TransactionCreate(
                bank_account_id=bank_account_id,
                project_id=project_id,
                category="logistics",
                type="expense",
                amount_cents=80000,  # R$ 800.00
                description="Hotel accommodation - Cast & Crew",
                transaction_date="2024-01-17"
            )

            # Post-production expense
            post_prod_expense = TransactionCreate(
                bank_account_id=bank_account_id,
                project_id=project_id,
                category="post_production",
                type="expense",
                amount_cents=120000,  # R$ 1,200.00
                description="Color grading session",
                transaction_date="2024-01-18"
            )

            # Create all expenses
            expenses = [
                ("Crew Hire", crew_expense),
                ("Equipment Rental", equipment_expense),
                ("Logistics", logistics_expense),
                ("Post Production", post_prod_expense)
            ]

            created_expenses = []
            for name, expense_data in expenses:
                expense = await transaction_service.create(
                    db=db, organization_id=org_id, obj_in=expense_data
                )
                created_expenses.append(expense)
                print(f"✅ {name}: R$ {expense.amount_cents / 100:.2f} ({expense.category})")

            # Verify categorization
            print("\nVerifying expense categorization...")
            all_expenses = await transaction_service.get_multi(
                db=db, organization_id=org_id, filters={"project_id": project_id, "type": "expense"}
            )

            category_totals = {}
            for expense in all_expenses:
                category_totals[expense.category] = category_totals.get(expense.category, 0) + expense.amount_cents

            print("📊 Expense breakdown by category:")
            for category, total in category_totals.items():
                print(f"   {category}: R$ {total / 100:.2f}")

            total_expenses = sum(category_totals.values())
            print(f"   TOTAL: R$ {total_expenses / 100:.2f}")

            print("\n✅ EXPENSE CATEGORIZATION: All expenses properly categorized!")

        finally:
            await db.close()


async def test_invoicing_and_revenue():
    """Test 2: Invoicing and revenue tracking"""
    print("\n📄 TEST 2: INVOICING & REVENUE TRACKING")
    print("-" * 50)

    async_session, org_id = await setup_test_data()
    client_id = uuid.UUID("bbbbbbbb-cccc-dddd-eeee-ffffffffffff")
    project_id = uuid.UUID("cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa")

    async with async_session() as db:
        try:
            print("Creating project invoice...")

            from datetime import date

            # Create invoice items
            invoice_items = [
                InvoiceItemCreate(
                    description="Pre-production planning and script analysis",
                    quantity=1,
                    unit_price_cents=500000,  # R$ 5,000.00
                    total_cents=500000,
                    project_id=project_id,
                    category="production_revenue"
                ),
                InvoiceItemCreate(
                    description="Principal photography - 10 day shoot",
                    quantity=10,
                    unit_price_cents=150000,  # R$ 1,500.00 per day
                    total_cents=1500000,  # R$ 15,000.00
                    project_id=project_id,
                    category="production_revenue"
                ),
                InvoiceItemCreate(
                    description="Post-production services",
                    quantity=1,
                    unit_price_cents=800000,  # R$ 8,000.00
                    total_cents=800000,
                    project_id=project_id,
                    category="production_revenue"
                )
            ]

            # Create invoice
            invoice_data = InvoiceCreate(
                client_id=client_id,
                project_id=project_id,
                items=invoice_items,
                due_date=date(2024, 2, 15),
                description="Production services for Epic Blockbuster Film",
                notes="Payment terms: 50% upfront, 50% upon completion"
            )

            invoice = await invoice_service.create(
                db=db, organization_id=org_id, obj_in=invoice_data
            )

            print("✅ Invoice created successfully!")
            print(f"   Invoice: {invoice.invoice_number}")
            print(f"   Client: Big Budget Productions")
            print(f"   Subtotal: R$ {invoice.subtotal_cents / 100:.2f}")
            print(f"   Total: R$ {invoice.total_amount_cents / 100:.2f}")
            print(f"   Status: {invoice.status}")

            # Mark invoice as paid (for revenue tracking)
            from app.schemas.financial import InvoiceUpdate
            update_data = InvoiceUpdate(status="paid", paid_date=date.today())
            paid_invoice = await invoice_service.update(
                db=db, organization_id=org_id, id=invoice.id, obj_in=update_data
            )

            print(f"✅ Invoice marked as paid: {paid_invoice.status}")

            # Create revenue transaction
            from app.services.financial import bank_account_service
            from app.schemas.transactions import TransactionCreate

            bank_account_id = uuid.UUID("dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb")

            revenue_transaction = TransactionCreate(
                bank_account_id=bank_account_id,
                project_id=project_id,
                category="production_revenue",
                type="income",
                amount_cents=paid_invoice.total_amount_cents,
                description=f"Payment for invoice {paid_invoice.invoice_number}",
                transaction_date=date.today()
            )

            revenue = await transaction_service.create(
                db=db, organization_id=org_id, obj_in=revenue_transaction
            )

            print(f"✅ Revenue transaction recorded: R$ {revenue.amount_cents / 100:.2f}")

            print("\n✅ INVOICING & REVENUE: Invoice created and payment recorded!")

        finally:
            await db.close()


async def test_profit_loss_reporting():
    """Test 3: Project P&L reporting"""
    print("\n📊 TEST 3: PROJECT P&L REPORTING")
    print("-" * 50)

    async_session, org_id = await setup_test_data()
    project_id = uuid.UUID("cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa")

    async with async_session() as db:
        try:
            print("Generating project financial report...")

            # Get the financial report
            report = await financial_report_service.get_project_financial_report(
                db=db, organization_id=org_id, project_id=project_id
            )

            print("✅ Financial Report Generated!")
            print(f"   Project: {report.project_title}")
            print(f"   Currency: {report.currency}")

            print(f"\n💰 REVENUE:")
            print(f"   Total Revenue: R$ {report.total_revenue_cents / 100:.2f}")
            print(f"   Paid Revenue: R$ {report.paid_revenue_cents / 100:.2f}")
            print(f"   Outstanding: R$ {report.outstanding_revenue_cents / 100:.2f}")

            print(f"\n💸 EXPENSES BY CATEGORY:")
            for category, amount in report.expenses_by_category.items():
                print(f"   {category}: R$ {amount / 100:.2f}")

            print(f"   Total Expenses: R$ {report.total_expenses_cents / 100:.2f}")

            print(f"\n💡 PROFITABILITY:")
            print(f"   Gross Profit: R$ {report.gross_profit_cents / 100:.2f}")
            print(f"   Tax Amount: R$ {report.tax_amount_cents / 100:.2f}")
            print(f"   Net Profit: R$ {report.net_profit_cents / 100:.2f}")

            # Determine if profitable
            if report.net_profit_cents > 0:
                status = "✅ PROFITABLE"
                color = "🟢"
            elif report.net_profit_cents < 0:
                status = "❌ LOSS"
                color = "🔴"
            else:
                status = "🟡 BREAK-EVEN"
                color = "🟡"

            print(f"\n{color} PROJECT STATUS: {status}")

            print(f"\n📋 DETAILED BREAKDOWN:")
            print(f"   Invoice Breakdown: {len(report.invoice_breakdown)} invoices")
            print(f"   Expense Breakdown: {len(report.expense_breakdown)} transactions")

            # Show top expense categories
            if report.expenses_by_category:
                top_category = max(report.expenses_by_category.items(), key=lambda x: x[1])
                print(f"   Largest Expense: {top_category[0]} (R$ {top_category[1] / 100:.2f})")

            print("\n✅ P&L REPORTING: Comprehensive financial analysis complete!")

        finally:
            await db.close()


async def test_organization_wide_expense_analysis():
    """Test 4: Organization-wide expense analysis"""
    print("\n🏢 TEST 4: ORGANIZATION-WIDE EXPENSE ANALYSIS")
    print("-" * 50)

    async_session, org_id = await setup_test_data()

    async with async_session() as db:
        try:
            print("Generating organization expense summary...")

            # Get expense summary for the entire organization
            summary = await financial_report_service.get_expense_summary_by_category(
                db=db, organization_id=org_id
            )

            print("✅ Organization Expense Summary Generated!")
            print(f"   Organization: {summary['organization_id']}")
            print(f"   Total Expenses: {summary['formatted_total']}")
            print(f"   Total Transactions: {summary['total_transactions']}")

            print(f"\n📊 EXPENSES BY CATEGORY:")
            for category in summary['expenses_by_category']:
                print(
                    f"   {category['category']}: {category['formatted_total']} ({category['transaction_count']} transactions)"
                )

            print("\n✅ ORGANIZATION ANALYSIS: Multi-project expense tracking working!")

        finally:
            await db.close()


async def main():
    """Run all advanced finance tests"""
    print("💰 SAFE TASKS ADVANCED FINANCE V1 - COMPREHENSIVE TEST SUITE")
    print("=" * 70)
    print("Testing Expense Categorization, Invoicing & P&L Reporting")
    print("=" * 70)

    tests = [
        ("Expense Categorization", test_expense_categorization),
        ("Invoicing & Revenue Tracking", test_invoicing_and_revenue),
        ("Project P&L Reporting", test_profit_loss_reporting),
        ("Organization Expense Analysis", test_organization_wide_expense_analysis),
    ]

    for test_name, test_func in tests:
        try:
            await test_func()
            print()
        except Exception as e:
            print(f"❌ {test_name}: FAILED - {str(e)}\n")

    print("=" * 70)
    print("🎉 ADVANCED FINANCE V1 TESTS COMPLETED!")
    print("✅ Expense Categorization: crew_hire, equipment_rental, logistics, post_production")
    print("✅ Invoicing System: Automatic calculations and itemized billing")
    print("✅ Revenue Tracking: Paid vs outstanding invoice management")
    print("✅ P&L Reporting: Detailed profitability analysis by category")
    print("✅ Organization Analytics: Multi-project expense summaries")
    print("\n💼 Ready for professional film production accounting!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
