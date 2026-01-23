
import sys
import os
import pytest

# Forçar o path novamente dentro do sub-processo do pytest
sys.path.insert(0, os.path.abspath('.'))

try:
    from app.core.config import settings
    from app.db.base import Base
except ImportError as e:
    pytest.fail(f"CRITICAL IMPORT ERROR: {e}")

def test_model_registry():
    print(" -> Checking Tables...")
    # Lista de tabelas esperadas no banco
    expected_tables = {
        "organizations", "profiles", "clients", "projects", "bank_accounts",
        "transactions", "call_sheets", "kits", "proposals",
        "stored_files", "notifications"
    }
    
    # Pega as tabelas que o SQLAlchemy encontrou
    actual_tables = set(Base.metadata.tables.keys())
    
    # Verifica se temos pelo menos as esperadas (pode ter mais)
    missing = expected_tables - actual_tables
    
    if missing:
        pytest.fail(f"MISSING TABLES: {missing}")
    
    print(f"✅ Found tables: {actual_tables}")

def test_schemas_load():
    print(" -> Checking Schemas...")
    # Tenta importar os schemas para validar o Pydantic V2
    try:
        from app.schemas import clients, financial, inventory, commercial
    except Exception as e:
        pytest.fail(f"SCHEMA ERROR: {e}")
