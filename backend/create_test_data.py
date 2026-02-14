import asyncio
import sys
from uuid import uuid4

# Garante que acha os módulos
sys.path.append(".")

from app.db.session import SessionLocal
from app.models import Organization, Profile, Client, Project
from app.models.call_sheets import CallSheet
from datetime import date, time


async def create_data():
    """
    Seeds the database with test data using the EXACT schema from app/models.

    Schema Reference (updated 2026-01-22 - V2 Architecture):
    - Organization: id, name, slug, plan, subscription_status, is_active, created_at, updated_at
    - Profile: id, email, organization_id, full_name, avatar_url, role, is_active, created_at, updated_at
    - Client: id, organization_id, name, email, document, phone, is_active, created_at, updated_at
    - Project: id, organization_id, client_id, title, description, status, budget_total_cents, start_date, end_date, is_active, created_at, updated_at
    """
    print("🌱 CRIANDO DADOS DE TESTE...")

    async with SessionLocal() as db:
        try:
            # 1. Criar Organização
            # Columns: id, name, slug, plan, subscription_status, is_active, created_at, updated_at
            org_id = uuid4()
            org = Organization(
                id=org_id,
                name="Produzo Studio Beta-2",
                slug="safetasks-beta-2",
                plan="professional",
                subscription_status="active"
            )
            db.add(org)
            await db.flush()  # Ensure org_id is persisted before FK references
            print(f"✅ Organization created: {org.name}")

            # 2. Criar Profile (Admin)
            # Columns: id, email, organization_id, full_name, avatar_url, role, is_active, created_at, updated_at
            # Note: id is the primary key (references auth.users in Supabase context)
            # Note: email is DENORMALIZED from Supabase for performance
            profile_id = uuid4()
            profile = Profile(
                id=profile_id,
                email="nicolas@produzo.app",
                organization_id=org_id,
                full_name="Nicolas Bertoni",
                role="admin"  # Valid: admin, manager, crew, viewer
            )
            db.add(profile)
            await db.flush()
            print(f"✅ Profile created: {profile.full_name} ({profile.role})")

            # 3. Criar Cliente
            # Columns: id, organization_id, name, email, document, phone, is_active, created_at, updated_at
            # Note: It's "document", NOT "document_id" (fixed naming convention)
            client_id = uuid4()
            client = Client(
                id=client_id,
                organization_id=org_id,
                name="Coca-Cola Brasil",
                email="marketing@coca.com",
                document="12345678000199",  # CPF/CNPJ
                phone="+5511999999999"
            )
            db.add(client)
            await db.flush()
            print(f"✅ Client created: {client.name}")

            # 4. Criar Projeto
            # Columns: id, organization_id, client_id, title, description, status, budget_total_cents, start_date, end_date, is_active, created_at, updated_at
            # Note: It's "title", NOT "name"
            # Note: budget_total_cents is now included (money in cents)
            # Valid status: draft, pre-production, production, post-production, delivered, archived
            project_id = uuid4()
            project = Project(
                id=project_id,
                organization_id=org_id,
                client_id=client_id,
                title="Comercial Verão 2026",  # CORRECT: title, not name
                description="Campanha publicitária de verão",
                status="pre-production",  # CORRECT: hyphen, not underscore
                budget_total_cents=15000000  # R$ 150.000,00 = 15000000 cents
            )
            db.add(project)
            await db.flush()
            print(f"✅ Project created: {project.title}")

            # 5. Criar Call Sheet Profissional
            # Columns: id, organization_id, project_id, shooting_day, status, location, location_address,
            #          parking_info, crew_call, on_set, lunch_time, wrap_time, weather, notes, hospital_info,
            #          created_at, updated_at
            call_sheet_id = uuid4()
            call_sheet = CallSheet(
                id=call_sheet_id,
                organization_id=org_id,
                project_id=project_id,
                shooting_day=date(2026, 2, 15),  # February 15, 2026
                status="confirmed",

                # Location Information
                location="Praia de Copacabana - Posto 6",
                location_address="Av. Atlântica, 3264 - Copacabana, Rio de Janeiro - RJ\nhttps://goo.gl/maps/exemplo123",
                parking_info="Estacionamento privado disponível na Rua Santa Clara, 50. Vagas limitadas - chegar cedo!",

                # Time Schedule
                crew_call=time(6, 0),      # 6:00 AM - General crew call
                on_set=time(7, 30),        # 7:30 AM - Ready to shoot (golden hour)
                lunch_time=time(12, 30),   # 12:30 PM - Lunch break
                wrap_time=time(18, 0),     # 6:00 PM - Expected wrap

                # Production Information
                weather="Sol com temperaturas entre 28-32°C. Vento moderado (15km/h). Maré baixa às 14h.",
                notes="IMPORTANTE: Filmagem em área pública - autorização da Prefeitura anexa. Trazer protetor solar e água. Figurino: roupas de verão coloridas.",

                # Safety & Logistics
                hospital_info="Hospital Copa Star - Emergência 24h\nRua Figueiredo de Magalhães, 875\nTel: (21) 2545-3600\nDistância: 1.2km (5 min)"
            )
            db.add(call_sheet)
            await db.flush()
            print(f"✅ Call Sheet created: {call_sheet.location} on {call_sheet.shooting_day}")

            await db.commit()
            print("\n" + "="*50)
            print("✅ SUCESSO! Todos os dados foram inseridos.")
            print("="*50)
            print(f"🏢 Organization ID: {org_id}")
            print(f"👤 Profile ID:      {profile_id}")
            print(f"🏭 Client ID:       {client_id}")
            print(f"🎬 Project ID:      {project_id}")
            print(f"🎬 Project Title:   {project.title}")
            print(f"📋 Call Sheet ID:   {call_sheet_id}")
            print(f"📋 Shooting Day:    {call_sheet.shooting_day}")
            print(f"📋 Location:        {call_sheet.location}")

        except Exception as e:
            print(f"\n❌ ERRO: {e}")
            import traceback
            traceback.print_exc()
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(create_data())
