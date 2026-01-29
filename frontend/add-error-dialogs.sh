#!/bin/bash

# List of all create/edit form pages that need ErrorDialog
PAGES=(
  # Stakeholders (already done)
  # "app/(dashboard)/stakeholders/new/page.tsx"
  "app/(dashboard)/stakeholders/[id]/page.tsx"
  
  # Projects
  "app/(dashboard)/projects/new/page.tsx"
  "app/(dashboard)/projects/[id]/edit/page.tsx"
  
  # Clients
  "app/(dashboard)/clients/new/page.tsx"
  "app/(dashboard)/clients/[id]/edit/page.tsx"
  
  # Suppliers
  "app/(dashboard)/suppliers/new/page.tsx"
  "app/(dashboard)/suppliers/[id]/edit/page.tsx"
  
  # Call Sheets
  "app/(dashboard)/call-sheets/new/page.tsx"
  "app/(dashboard)/call-sheets/[id]/edit/page.tsx"
  
  # Characters
  "app/(dashboard)/characters/new/page.tsx"
  "app/(dashboard)/characters/[id]/edit/page.tsx"
  
  # Scenes
  "app/(dashboard)/scenes/new/page.tsx"
  "app/(dashboard)/scenes/[id]/edit/page.tsx"
  
  # Shooting Days
  "app/(dashboard)/shooting-days/new/page.tsx"
  "app/(dashboard)/shooting-days/[id]/edit/page.tsx"
  
  # Proposals
  "app/(dashboard)/proposals/new/page.tsx"
  "app/(dashboard)/proposals/[id]/edit/page.tsx"
  
  # Financials - Bank Accounts
  "app/(dashboard)/financials/bank-accounts/new/page.tsx"
  "app/(dashboard)/financials/bank-accounts/[id]/edit/page.tsx"
  
  # Financials - Transactions
  "app/(dashboard)/financials/transactions/new/page.tsx"
  
  # Financials - Invoices
  "app/(dashboard)/financials/new-invoice/page.tsx"
  "app/(dashboard)/financials/invoices/[id]/edit/page.tsx"
  
  # Financials - Tax Tables
  "app/(dashboard)/financials/tax-tables/new/page.tsx"
  "app/(dashboard)/financials/tax-tables/[id]/edit/page.tsx"
  
  # Inventory - Kits
  "app/(dashboard)/inventory/kits/new/page.tsx"
  "app/(dashboard)/inventory/kits/[id]/edit/page.tsx"
  
  # Inventory - Items
  "app/(dashboard)/inventory/items/new/page.tsx"
  "app/(dashboard)/inventory/items/[id]/edit/page.tsx"
)

echo "Found ${#PAGES[@]} pages to update with ErrorDialog"
for page in "${PAGES[@]}"; do
  echo "  - $page"
done
