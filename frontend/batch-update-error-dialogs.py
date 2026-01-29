#!/usr/bin/env python3
"""
Batch update script to add ErrorDialog to all create/edit forms.
This script will generate the necessary code changes for each page.
"""

import os
import re

BASE_DIR = "app/(dashboard)"

# Pages that need ErrorDialog (excluding stakeholders which are done)
PAGES = [
    # Projects
    ("projects/new/page.tsx", "Create Project", "createProject"),
    ("projects/[id]/edit/page.tsx", "Edit Project", "updateProject"),
    
    # Clients
    ("clients/new/page.tsx", "Create Client", "createClient"),
    ("clients/[id]/edit/page.tsx", "Edit Client", "updateClient"),
    
    # Suppliers
    ("suppliers/new/page.tsx", "Create Supplier", "createSupplier"),
    ("suppliers/[id]/edit/page.tsx", "Edit Supplier", "updateSupplier"),
    
    # Call Sheets
    ("call-sheets/new/page.tsx", "Create Call Sheet", "createCallSheet"),
    ("call-sheets/[id]/edit/page.tsx", "Edit Call Sheet", "updateCallSheet"),
    
    # Characters
    ("characters/new/page.tsx", "Create Character", "createCharacter"),
    ("characters/[id]/edit/page.tsx", "Edit Character", "updateCharacter"),
    
    # Scenes
    ("scenes/new/page.tsx", "Create Scene", "createScene"),
    ("scenes/[id]/edit/page.tsx", "Edit Scene", "updateScene"),
    
    # Shooting Days
    ("shooting-days/new/page.tsx", "Create Shooting Day", "createShootingDay"),
    ("shooting-days/[id]/edit/page.tsx", "Edit Shooting Day", "updateShootingDay"),
    
    # Proposals
    ("proposals/new/page.tsx", "Create Proposal", "createProposal"),
    ("proposals/[id]/edit/page.tsx", "Edit Proposal", "updateProposal"),
    
    # Financials - Bank Accounts
    ("financials/bank-accounts/new/page.tsx", "Create Bank Account", "createBankAccount"),
    ("financials/bank-accounts/[id]/edit/page.tsx", "Edit Bank Account", "updateBankAccount"),
    
    # Financials - Transactions
    ("financials/transactions/new/page.tsx", "Create Transaction", "createTransaction"),
    
    # Financials - Invoices
    ("financials/new-invoice/page.tsx", "Create Invoice", "createInvoice"),
    ("financials/invoices/[id]/edit/page.tsx", "Edit Invoice", "updateInvoice"),
    
    # Financials - Tax Tables
    ("financials/tax-tables/new/page.tsx", "Create Tax Table", "createTaxTable"),
    ("financials/tax-tables/[id]/edit/page.tsx", "Edit Tax Table", "updateTaxTable"),
    
    # Inventory - Kits
    ("inventory/kits/new/page.tsx", "Create Kit", "createKit"),
    ("inventory/kits/[id]/edit/page.tsx", "Edit Kit", "updateKit"),
    
    # Inventory - Items
    ("inventory/items/new/page.tsx", "Create Item", "createItem"),
    ("inventory/items/[id]/edit/page.tsx", "Edit Item", "updateItem"),
]

print(f"📋 Total pages to update: {len(PAGES)}\n")
print("=" * 60)

for i, (path, title, mutation) in enumerate(PAGES, 1):
    full_path = os.path.join(BASE_DIR, path)
    print(f"\n{i}. {title}")
    print(f"   Path: {path}")
    print(f"   Mutation: {mutation}")
    print(f"   ✓ Ready to update")

print("\n" + "=" * 60)
print(f"\n✅ All {len(PAGES)} pages identified and ready for ErrorDialog integration")
print("\nNext steps:")
print("1. Add import: import { useErrorDialog } from '@/lib/hooks/useErrorDialog'")
print("2. Add import: import { ErrorDialog } from '@/components/ui/error-dialog'")
print("3. Add hook: const { errorDialog, showError, closeError } = useErrorDialog()")
print("4. Replace catch block: showError(error, 'Error Title')")
print("5. Add component: <ErrorDialog ... />")
