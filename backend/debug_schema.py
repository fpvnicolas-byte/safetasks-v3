import sys
import os

# Adiciona o diretório atual ao path para encontrar o 'app'
sys.path.append(os.getcwd())

schemas_to_check = [
    "app.schemas.clients",
    "app.schemas.projects",
    "app.schemas.financial",
    "app.schemas.bank_accounts",
    "app.schemas.transactions",
    "app.schemas.production",
    "app.schemas.inventory"
]

print("🔍 INICIANDO VARREDURA DE SCHEMAS...")
for schema in schemas_to_check:
    try:
        __import__(schema)
        print(f"✅ {schema}: OK")
    except Exception as e:
        print(f"❌ {schema}: QUEBRADO! -> {e}")