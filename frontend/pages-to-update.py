"""
Script to add ErrorDialog to all create/edit forms
"""

PAGES_TO_UPDATE = [
    ("stakeholders/[id]/page.tsx", "Edit Stakeholder"),
    ("projects/new/page.tsx", "Create Project"),
    ("projects/[id]/edit/page.tsx", "Edit Project"),
    ("clients/new/page.tsx", "Create Client"),
    ("clients/[id]/edit/page.tsx", "Edit Client"),
    ("suppliers/new/page.tsx", "Create Supplier"),
    ("suppliers/[id]/edit/page.tsx", "Edit Supplier"),
    ("call-sheets/new/page.tsx", "Create Call Sheet"),
    ("call-sheets/[id]/edit/page.tsx", "Edit Call Sheet"),
    ("characters/new/page.tsx", "Create Character"),
    ("characters/[id]/edit/page.tsx", "Edit Character"),
    ("scenes/new/page.tsx", "Create Scene"),
    ("scenes/[id]/edit/page.tsx", "Edit Scene"),
    ("shooting-days/new/page.tsx", "Create Shooting Day"),
    ("shooting-days/[id]/edit/page.tsx", "Edit Shooting Day"),
    ("proposals/new/page.tsx", "Create Proposal"),
    ("proposals/[id]/edit/page.tsx", "Edit Proposal"),
    ("financials/bank-accounts/new/page.tsx", "Create Bank Account"),
    ("financials/bank-accounts/[id]/edit/page.tsx", "Edit Bank Account"),
    ("financials/transactions/new/page.tsx", "Create Transaction"),
    ("financials/new-invoice/page.tsx", "Create Invoice"),
    ("financials/invoices/[id]/edit/page.tsx", "Edit Invoice"),
    ("financials/tax-tables/new/page.tsx", "Create Tax Table"),
    ("financials/tax-tables/[id]/edit/page.tsx", "Edit Tax Table"),
    ("inventory/kits/new/page.tsx", "Create Kit"),
    ("inventory/kits/[id]/edit/page.tsx", "Edit Kit"),
    ("inventory/items/new/page.tsx", "Create Item"),
    ("inventory/items/[id]/edit/page.tsx", "Edit Item"),
]

print(f"Total pages to update: {len(PAGES_TO_UPDATE)}")
print("\nPages:")
for path, title in PAGES_TO_UPDATE:
    print(f"  - {path} ({title})")
