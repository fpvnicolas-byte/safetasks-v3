#!/usr/bin/env python3
"""
Comprehensive update plan for all remaining 18 pages
"""

REMAINING_PAGES = {
    "Production (6 pages)": [
        "call-sheets/new/page.tsx",
        "call-sheets/[id]/edit/page.tsx",
        "characters/[id]/edit/page.tsx",
        "scenes/[id]/edit/page.tsx",
        "shooting-days/new/page.tsx",
        "shooting-days/[id]/edit/page.tsx",
    ],
    "Proposals (2 pages)": [
        "proposals/new/page.tsx",
        "proposals/[id]/edit/page.tsx",
    ],
    "Financials (7 pages)": [
        "financials/bank-accounts/new/page.tsx",
        "financials/bank-accounts/[id]/edit/page.tsx",
        "financials/transactions/new/page.tsx",
        "financials/new-invoice/page.tsx",
        "financials/invoices/[id]/edit/page.tsx",
        "financials/tax-tables/new/page.tsx",
        "financials/tax-tables/[id]/edit/page.tsx",
    ],
    "Inventory (4 pages)": [
        "inventory/kits/new/page.tsx",
        "inventory/kits/[id]/edit/page.tsx",
        "inventory/items/new/page.tsx",
        "inventory/items/[id]/edit/page.tsx",
    ],
}

total = sum(len(pages) for pages in REMAINING_PAGES.values())
print(f"📋 Remaining Pages to Update: {total}\n")
print("=" * 60)

for category, pages in REMAINING_PAGES.items():
    print(f"\n{category}")
    for page in pages:
        print(f"  - {page}")

print("\n" + "=" * 60)
print(f"\n✅ Total: {total} pages")
