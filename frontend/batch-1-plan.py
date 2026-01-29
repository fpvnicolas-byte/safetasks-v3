#!/usr/bin/env python3
"""
Quick script to update multiple pages with ErrorDialog in batch.
This will generate the update commands for the high-priority pages.
"""

# Pages to update in this batch
BATCH_1 = [
    ("projects/[id]/edit/page.tsx", "Edit Project"),
    ("clients/new/page.tsx", "Create Client"),  
    ("clients/[id]/edit/page.tsx", "Edit Client"),
    ("suppliers/new/page.tsx", "Create Supplier"),
    ("suppliers/[id]/edit/page.tsx", "Edit Supplier"),
]

print("🚀 Batch 1: High-Priority Pages (5 pages)")
print("=" * 60)

for path, title in BATCH_1:
    print(f"\n✓ {title}")
    print(f"  Path: app/(dashboard)/{path}")
    print(f"  Changes:")
    print(f"    1. Add: import {{ useErrorDialog }} from '@/lib/hooks/useErrorDialog'")
    print(f"    2. Add: import {{ ErrorDialog }} from '@/components/ui/error-dialog'")
    print(f"    3. Remove: Alert import and usage")
    print(f"    4. Add: const {{ errorDialog, showError, closeError }} = useErrorDialog()")
    print(f"    5. Replace: catch blocks with showError()")
    print(f"    6. Add: <ErrorDialog /> component")

print("\n" + "=" * 60)
print("\n✅ Ready to update 5 high-priority pages!")
