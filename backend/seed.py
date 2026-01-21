import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from app.core.database import AsyncSessionLocal
from app.core.models import User, Organization
from app.modules.inventory.models import Equipment
from app.modules.commercial.models import Client, Budget
from app.modules.production.models import Script

# Cores para o terminal
GREEN = "\033[92m"
RESET = "\033[0m"

async def seed_data():
    print(f"{GREEN}🌱 Iniciando o plantio de dados (Seed) - Versão Final Corrigida...{RESET}")
    
    async with AsyncSessionLocal() as session:
        # 1. Criar Organização
        print("🏢 Criando Organização...")
        org = Organization(name="Safe Tasks Demo Studio")
        session.add(org)
        await session.flush()

        # 2. Criar Usuário Admin
        print("👤 Criando Usuário Admin...")
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            email="admin@safetasks.com.br",
            full_name="Nicolas Admin",
            role="admin",
            is_active=True,
            organization_id=org.id
        )
        session.add(user)
        await session.flush()

        # 3. Criar Clientes (CORRIGIDO: Campos batendo com models.py)
        print("🤝 Criando Clientes...")
        clients = [
            Client(
                name="Red Bull",
                legal_name="Red Bull Brasil Ltda", # Era trade_name
                tax_id="00.000.000/0001-01",
                email="marketing@redbull.com.br",
                phone="(11) 99999-9999",
                payment_terms_days=30 # Era payment_terms="30_days"
                # Removido created_by pois não existe no modelo
            ),
            Client(
                name="Netflix",
                legal_name="Netflix Entretenimento Brasil",
                tax_id="11.111.111/0001-11",
                email="production@netflix.com",
                phone="(11) 88888-8888",
                payment_terms_days=15
            )
        ]
        session.add_all(clients)
        await session.flush()

        # 4. Criar Inventário
        print("📦 Criando Inventário de Equipamentos...")
        equipments = [
            Equipment(
                name="Sony FX6 Full-Frame Cinema Camera",
                category="CAMERA", 
                serial_number="SN-FX6-001",
                purchased_at=datetime.now(timezone.utc).date() - timedelta(days=100),
                purchase_price_cents=3500000, 
                status="available",
                created_by=user_id
            ),
            Equipment(
                name="Blackmagic Pocket 6K Pro",
                category="CAMERA",
                serial_number="SN-BMPCC-99",
                purchased_at=datetime.now(timezone.utc).date() - timedelta(days=200),
                purchase_price_cents=1800000, 
                status="in_use",
                created_by=user_id
            ),
            Equipment(
                name="DJI Mavic 3 Cine",
                category="DRONE",
                serial_number="DJI-M3-CINE-X",
                purchased_at=datetime.now(timezone.utc).date() - timedelta(days=30),
                purchase_price_cents=2800000, 
                status="available",
                created_by=user_id
            ),
            Equipment(
                name="Custom 5-inch Freestyle FPV Drone",
                category="DRONE",
                serial_number="FPV-CUSTOM-01",
                description="Frame Apex, DJI O3 Air Unit, TBS Crossfire",
                purchase_price_cents=450000, 
                status="maintenance",
                created_by=user_id
            )
        ]
        session.add_all(equipments)
        
        # 5. Criar um Roteiro Exemplo
        print("🎬 Criando Roteiro Exemplo...")
        script = Script(
            title="Comercial Red Bull - FPV Chase",
            content_text="INT. GARAGE - DAY\nA driver puts on his helmet.\n\nEXT. RACETRACK - DAY\nThe car speeds up. The FPV Drone follows close behind.",
            created_by=user_id,
            processed=False
        )
        session.add(script)

        # 6. Criar um Orçamento (CORRIGIDO: Campos batendo com models.py)
        print("💰 Criando Orçamento Exemplo...")
        budget = Budget(
            client_id=clients[0].id,
            name="Cobertura F1 Interlagos", # Era title
            status="draft",
            total_cents=1500000, # Era total_amount
            version=1,
            created_by=user_id,
            line_items=[ # Era items
                {"name": "Diária Operador FPV", "quantity": 1, "unit_price": 250000, "total": 250000},
                {"name": "Diária Locação Drone", "quantity": 1, "unit_price": 100000, "total": 100000}
            ]
        )
        session.add(budget)

        await session.commit()
        print(f"{GREEN}✅ Seed concluído com sucesso! Banco de dados populado.{RESET}")

if __name__ == "__main__":
    asyncio.run(seed_data())