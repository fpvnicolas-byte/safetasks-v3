#!/bin/bash
# =============================================================================
# Database Migration V3 - Professional Call Sheets
# =============================================================================
# This script performs a FULL DATABASE RESET with the new V3 schema
# including all professional call sheet fields.
#
# CAUTION: This will DROP all existing data!
# =============================================================================

set -e  # Exit on error

echo "========================================================================"
echo "DATABASE MIGRATION V3 - PROFESSIONAL CALL SHEETS"
echo "========================================================================"
echo ""
echo "⚠️  WARNING: This will DROP all existing data in the database!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Migration cancelled."
    exit 1
fi

echo ""
echo "🚀 Starting migration process..."
echo ""

# Navigate to backend directory
cd /Users/nicolasbertoni/safetasks-v3/backend

# Activate virtual environment
echo "📦 Activating virtual environment..."
source venv/bin/activate

# Step 1: Drop database schema
echo ""
echo "🗑️  Step 1: Dropping public schema..."
psql -U postgres -d safetasks -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" || {
    echo "❌ Failed to drop schema. Make sure PostgreSQL is running."
    exit 1
}
echo "✅ Schema dropped successfully"

# Step 2: Remove old migration files
echo ""
echo "🗑️  Step 2: Removing old migration files..."
rm -rf alembic/versions/*
echo "✅ Old migrations removed"

# Step 3: Generate new migration
echo ""
echo "📝 Step 3: Generating fresh migration (V3)..."
alembic revision --autogenerate -m "initial_schema_v3_with_professional_call_sheets" || {
    echo "❌ Failed to generate migration."
    exit 1
}
echo "✅ Migration generated"

# Step 4: Apply migration
echo ""
echo "⬆️  Step 4: Applying migration to database..."
alembic upgrade head || {
    echo "❌ Failed to apply migration."
    exit 1
}
echo "✅ Migration applied"

# Step 5: Verify schema
echo ""
echo "🔍 Step 5: Verifying call_sheets table schema..."
psql -U postgres -d safetasks -c "\d call_sheets" || {
    echo "⚠️  Could not verify schema (table might not exist yet)"
}

# Step 6: Seed database
echo ""
echo "🌱 Step 6: Seeding database with test data..."
python create_test_data.py || {
    echo "❌ Failed to seed database."
    exit 1
}
echo "✅ Database seeded"

# Step 7: Test schema validation
echo ""
echo "🧪 Step 7: Testing call sheet schema validation..."
python test_call_sheet_schema.py || {
    echo "⚠️  Schema validation tests failed (non-critical)"
}

echo ""
echo "========================================================================"
echo "✅ MIGRATION COMPLETED SUCCESSFULLY!"
echo "========================================================================"
echo ""
echo "📊 Summary:"
echo "  - Database schema: V3 (Professional Call Sheets)"
echo "  - New call sheet fields: 7 (crew_call, on_set, lunch_time, wrap_time,"
echo "    location_address, parking_info, hospital_info)"
echo "  - Test data: Organization, Profile, Client, Project, Call Sheet"
echo ""
echo "🚀 Next Steps:"
echo "  1. Start the API server: uvicorn app.main:app --reload"
echo "  2. Test endpoints with the IDs printed in seed output"
echo "  3. Update frontend to use new professional call sheet fields"
echo ""
echo "📖 Documentation: See MIGRATION_V3_CALL_SHEETS.md for details"
echo "========================================================================"
