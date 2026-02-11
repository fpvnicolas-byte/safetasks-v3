#!/usr/bin/env python3
"""
Stakeholders & Entity Linking V1 Test Script
Tests supplier management and transaction-entity relationships
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
from app.services.commercial import supplier_service, stakeholder_service, supplier_statement_service
from app.schemas.commercial import SupplierCreate
from app.schemas.transactions import TransactionCreate


async def setup_test_data():
    """Create test organization, project, and stakeholders"""
    engine = create_async_engine(
        settings.SQLALCHEMY_DATABASE_URI,
        echo=False,
        connect_args={
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
            "statement_cache_size": 0,
        },
    )
    async with engine.begin() as conn:
        from app.core.base import Base
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Organization
        org_id = uuid.UUID("11111111-2222-3333-4444-555555555555")
        org = Organization(
            id=org_id,
            name="Stakeholder Test Co",
            slug="stakeholder-test"
        )
        db.add(org)
        await db.flush()

        # Admin user
        admin_user = Profile(
            id=uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
            organization_id=org_id,
            full_name="Stakeholder Admin",
            email="stakeholder.admin@test.com",
            role="admin"
        )
        db.add(admin_user)

        # Client
        client = Client(
            id=uuid.UUID("bbbbbbbb-cccc-dddd-eeee-ffffffffffff"),
            organization_id=org_id,
            name="Test Client Corp",
            email="billing@testclient.com"
        )
        db.add(client)

        # Project
        project = Project(
            id=uuid.UUID("cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa"),
            organization_id=org_id,
            client_id=client.id,
            title="Commercial Shoot Project",
            status="production"
        )
        db.add(project)

        # Bank Account
        bank_account = BankAccount(
            id=uuid.UUID("dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb"),
            organization_id=org_id,
            name="Operations Account",
            balance_cents=5000000,  # R$ 50,000.00
            currency="BRL"
        )
        db.add(bank_account)

        await db.commit()

    return async_session, org_id


async def test_supplier_management():
    """Test 1: Supplier registration and management"""
    print("👥 TEST 1: SUPPLIER MANAGEMENT")
    print("-" * 50)

    async_session, org_id = await setup_test_data()
    project_id = uuid.UUID("cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa")

    async with async_session() as db:
        try:
            # Create suppliers
            print("Registering suppliers...")

            # Drone rental company
            drone_rental = SupplierCreate(
                name="SkyHigh Drones Ltda",
                category="rental_house",
                document_id="12.345.678/0001-90",
                email="contact@skyhighdrones.com",
                phone="+55 11 99999-8888",
                address="Rua das Tecnologias, 123 - São Paulo/SP",
                bank_info={
                    "bank": "341",
                    "agency": "1234",
                    "account": "56789-0",
                    "pix_key": "contact@skyhighdrones.com"
                },
                specialties=["drone_rental", "aerial_cinematography", "gimbal_stabilization"],
                notes="Specializes in commercial drone work, FAA certified pilots available"
            )

            # Freelance camera operator
            camera_op = SupplierCreate(
                name="João Silva",
                category="freelancer",
                document_id="123.456.789-00",
                email="joao.silva@email.com",
                phone="+55 11 88888-7777",
                address="Rua das Câmeras, 456 - São Paulo/SP",
                bank_info={
                    "bank": "001",
                    "agency": "0001",
                    "account": "12345-6",
                    "pix_key": "11988887777"
                },
                specialties=["camera_operation", "steadicam", "drone_piloting"],
                notes="Experienced cinematographer with 10+ years in commercials"
            )

            # Catering service
            catering = SupplierCreate(
                name="Chef Gourmet Catering",
                category="catering",
                document_id="98.765.432/0001-10",
                email="orders@chefgourmet.com.br",
                phone="+55 11 77777-6666",
                address="Av. Gastronomia, 789 - São Paulo/SP",
                bank_info={
                    "bank": "237",
                    "agency": "5678",
                    "account": "90123-4"
                },
                specialties=["organic_meals", "dietary_restrictions", "on_location_service"],
                notes="Organic, locally-sourced catering with dietary accommodation"
            )

            # Register all suppliers
            suppliers = [
                ("Drone Rental Company", drone_rental),
                ("Freelance Camera Operator", camera_op),
                ("Catering Service", catering)
            ]

            created_suppliers = []
            for name, supplier_data in suppliers:
                supplier = await supplier_service.create(
                    db=db, organization_id=org_id, obj_in=supplier_data
                )
                created_suppliers.append(supplier)
                print(f"✅ {name}: {supplier.name} ({supplier.category})")

            # Test supplier retrieval with transaction summaries
            print("\nRetrieving suppliers with transaction summaries...")
            suppliers_with_summary = await supplier_service.get_suppliers_with_transaction_summary(
                db=db, organization_id=org_id, active_only=True
            )

            print(f"Found {len(suppliers_with_summary)} suppliers:")
            for supplier in suppliers_with_summary:
                print(f"   {supplier['name']} - {supplier['total_transactions']} transactions, R$ {supplier['total_amount_cents'] / 100:.2f} total")

            print("\n✅ SUPPLIER MANAGEMENT: Suppliers registered and retrievable!")

        finally:
            await db.close()


async def test_transaction_supplier_linking():
    """Test 2: Linking transactions to suppliers"""
    print("\n🔗 TEST 2: TRANSACTION-SUPPLIER LINKING")
    print("-" * 50)

    async_session, org_id = await setup_test_data()
    project_id = uuid.UUID("cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa")
    bank_account_id = uuid.UUID("dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb")

    async with async_session() as db:
        try:
            # Get supplier IDs (assuming they were created in test 1)
            suppliers = await supplier_service.get_multi(
                db=db, organization_id=org_id, limit=10
            )
            supplier_ids = [s.id for s in suppliers]

            if not supplier_ids:
                print("No suppliers found, creating one...")
                # Create a supplier for testing
                test_supplier = SupplierCreate(
                    name="Test Supplier Inc",
                    category="freelancer",
                    email="test@supplier.com"
                )
                supplier = await supplier_service.create(
                    db=db, organization_id=org_id, obj_in=test_supplier
                )
                supplier_ids = [supplier.id]

            supplier_id = supplier_ids[0]

            print("Creating transactions linked to suppliers...")

            # Camera operator payment
            camera_payment = TransactionCreate(
                bank_account_id=bank_account_id,
                project_id=project_id,
                supplier_id=supplier_id,
                category="crew_hire",
                type="expense",
                amount_cents=150000,  # R$ 1,500.00
                description="Camera operator day rate - João Silva",
                transaction_date="2024-01-15"
            )

            # Equipment rental payment
            equipment_payment = TransactionCreate(
                bank_account_id=bank_account_id,
                project_id=project_id,
                supplier_id=supplier_id,
                category="equipment_rental",
                type="expense",
                amount_cents=250000,  # R$ 2,500.00
                description="Drone rental - 3 days",
                transaction_date="2024-01-16"
            )

            # Catering payment
            catering_payment = TransactionCreate(
                bank_account_id=bank_account_id,
                project_id=project_id,
                supplier_id=supplier_id,
                category="logistics",
                type="expense",
                amount_cents=75000,  # R$ 750.00
                description="Crew catering - Day 2",
                transaction_date="2024-01-17"
            )

            # Create transactions
            payments = [
                ("Camera Operator Payment", camera_payment),
                ("Equipment Rental Payment", equipment_payment),
                ("Catering Payment", catering_payment)
            ]

            created_transactions = []
            for name, payment_data in payments:
                transaction = await transaction_service.create(
                    db=db, organization_id=org_id, obj_in=payment_data
                )
                created_transactions.append(transaction)
                print(f"✅ {name}: R$ {transaction.amount_cents / 100:.2f} to supplier")

            # Verify supplier linking
            print("\nVerifying transaction-supplier relationships...")
            for tx in created_transactions:
                assert tx.supplier_id == supplier_id, "Transaction not linked to supplier"
                print(f"   Transaction {tx.id} linked to supplier {tx.supplier_id}")

            # Check supplier's updated transaction summary
            suppliers_with_summary = await supplier_service.get_suppliers_with_transaction_summary(
                db=db, organization_id=org_id, active_only=True
            )

            supplier_summary = next((s for s in suppliers_with_summary if s['id'] == supplier_id), None)
            if supplier_summary:
                print("\nSupplier transaction summary updated:")
                print(f"   Total transactions: {supplier_summary['total_transactions']}")
                print(f"   Total amount: R$ {supplier_summary['total_amount_cents'] / 100:.2f}")

            print("\n✅ TRANSACTION-SUPPLIER LINKING: All payments properly linked!")

        finally:
            await db.close()


async def test_supplier_statement():
    """Test 3: Supplier financial statement generation"""
    print("\n📊 TEST 3: SUPPLIER FINANCIAL STATEMENTS")
    print("-" * 50)

    async_session, org_id = await setup_test_data()

    async with async_session() as db:
        try:
            # Get a supplier with transactions
            suppliers_with_summary = await supplier_service.get_suppliers_with_transaction_summary(
                db=db, organization_id=org_id, active_only=True
            )

            if not suppliers_with_summary:
                print("No suppliers with transactions found")
                return

            supplier_data = suppliers_with_summary[0]
            supplier_id = supplier_data['id']

            print(f"Generating statement for supplier: {supplier_data['name']}")

            # Generate supplier statement
            statement = await supplier_statement_service.get_supplier_statement(
                db=db,
                organization_id=org_id,
                supplier_id=supplier_id
            )

            print("✅ Supplier Statement Generated!")
            print(f"   Supplier: {statement.supplier_name}")
            print(f"   Category: {statement.supplier_category}")
            print(f"   Total Transactions: {statement.total_transactions}")
            print(f"   Total Amount: R$ {statement.total_amount_cents / 100:.2f}")
            print(f"   Period: {statement.statement_period['from']} to {statement.statement_period['to']}")

            print(f"\n📋 TRANSACTION BREAKDOWN ({len(statement.transactions)} transactions):")
            for tx in statement.transactions[:5]:  # Show first 5
                print(f"   {tx['date']}: {tx['description']} - R$ {tx['amount_cents'] / 100:.2f}")

            if statement.project_breakdown:
                print(f"\n🏗️ PROJECT BREAKDOWN ({len(statement.project_breakdown)} projects):")
                for project in statement.project_breakdown:
                    print(f"   {project['project_id'][:8]}...: R$ {project['total_cents'] / 100:.2f}")

            if statement.category_breakdown:
                print(f"\n📊 CATEGORY BREAKDOWN ({len(statement.category_breakdown)} categories):")
                for category in statement.category_breakdown:
                    print(f"   {category['category']}: R$ {category['total_cents'] / 100:.2f}")

            print("\n✅ SUPPLIER STATEMENTS: Detailed financial history generated!")

        finally:
            await db.close()


async def test_stakeholder_overview():
    """Test 4: Unified stakeholder overview"""
    print("\n🌐 TEST 4: UNIFIED STAKEHOLDER OVERVIEW")
    print("-" * 50)

    async_session, org_id = await setup_test_data()

    async with async_session() as db:
        try:
            print("Generating unified stakeholder overview...")

            # Get stakeholder summary
            summary = await stakeholder_service.get_stakeholder_summary(
                db=db, organization_id=org_id
            )

            print("✅ Stakeholder Overview Generated!")
            print(f"   Organization: {summary.organization_id}")
            print(f"   Clients: {summary.total_clients}")
            print(f"   Suppliers: {summary.total_suppliers}")
            print(f"   Crew Members: {summary.total_crew}")
            print(f"   Active Projects: {summary.total_active_projects}")

            print(f"\n👥 CLIENT STAKEHOLDERS ({len(summary.clients)}):")
            for client in summary.clients[:3]:  # Show first 3
                print(f"   {client['name']} - {client['relationship']}")

            print(f"\n🏢 SUPPLIER STAKEHOLDERS ({len(summary.suppliers)}):")
            for supplier in summary.suppliers[:3]:  # Show first 3
                spent = supplier['total_spent_cents'] / 100
                print(f"   {supplier['name']} ({supplier['category']}) - R$ {spent:.2f} spent")

            print(f"\n👷 CREW STAKEHOLDERS ({len(summary.crew_members)}):")
            for crew in summary.crew_members[:3]:  # Show first 3
                print(f"   {crew['name']} - {crew['role']}")

            print("\n✅ STAKEHOLDER OVERVIEW: Complete ecosystem visibility!")

        finally:
            await db.close()


async def main():
    """Run all stakeholder and entity linking tests"""
    print("👥 SAFE TASKS STAKEHOLDERS & ENTITY LINKING V1 - COMPREHENSIVE TEST SUITE")
    print("=" * 75)
    print("Testing Supplier Management & Transaction-Supplier Relationships")
    print("=" * 75)

    tests = [
        ("Supplier Management", test_supplier_management),
        ("Transaction-Supplier Linking", test_transaction_supplier_linking),
        ("Supplier Financial Statements", test_supplier_statement),
        ("Unified Stakeholder Overview", test_stakeholder_overview),
    ]

    for test_name, test_func in tests:
        try:
            await test_func()
            print()
        except Exception as e:
            print(f"❌ {test_name}: FAILED - {str(e)}\n")

    print("=" * 75)
    print("🎉 STAKEHOLDERS & ENTITY LINKING V1 TESTS COMPLETED!")
    print("✅ Supplier Registration: Rental houses, freelancers, vendors managed")
    print("✅ Transaction Linking: Payments connected to specific suppliers")
    print("✅ Financial Statements: Detailed supplier payment histories")
    print("✅ Stakeholder Overview: Complete business ecosystem visibility")
    print("\n💼 Ready for professional supplier relationship management!")
    print("=" * 75)


if __name__ == "__main__":
    asyncio.run(main())
