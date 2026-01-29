#!/usr/bin/env python3
"""
Batch 2: Production Forms (8 pages)
"""

BATCH_2 = [
    ("call-sheets/new/page.tsx", "Create Call Sheet"),
    ("call-sheets/[id]/edit/page.tsx", "Edit Call Sheet"),
    ("characters/new/page.tsx", "Create Character"),
    ("characters/[id]/edit/page.tsx", "Edit Character"),
    ("scenes/new/page.tsx", "Create Scene"),
    ("scenes/[id]/edit/page.tsx", "Edit Scene"),
    ("shooting-days/new/page.tsx", "Create Shooting Day"),
    ("shooting-days/[id]/edit/page.tsx", "Edit Shooting Day"),
]

print("🎬 Batch 2: Production Forms (8 pages)")
print("=" * 60)

for path, title in BATCH_2:
    print(f"✓ {title}: app/(dashboard)/{path}")

print("\n" + "=" * 60)
print(f"✅ Ready to update {len(BATCH_2)} production pages!")
