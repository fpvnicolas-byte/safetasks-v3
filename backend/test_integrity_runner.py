import sys
import os
from unittest.mock import MagicMock
import pytest

# 1. Mockar as dependências do Google ANTES de qualquer importação
sys.modules["google.generativeai"] = MagicMock()
sys.modules["google.generativeai.types"] = MagicMock()

# 2. Adicionar o diretório atual ao path do Python (para achar o 'app')
current_dir = os.getcwd()
sys.path.insert(0, current_dir)

if __name__ == "__main__":
    print(f"🚀 RUNNING FINAL INTEGRITY CHECK (Root: {current_dir})")
    
    # Certifique-se que a pasta tests existe
    if not os.path.exists("tests"):
        os.makedirs("tests")

    # O código do teste interno
    test_code = """
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
"""
    
    # Escreve o arquivo de teste
    with open("tests/test_final_check.py", "w") as f:
        f.write(test_code)
        
    # Roda o pytest apontando explicitamente para o arquivo
    # -v: verbose
    # -s: mostra os prints no console
    ret = pytest.main(["tests/test_final_check.py", "-v", "-s"])
    
    if ret == 0:
        print("\n🟢 SISTEMA OPERACIONAL. MODELOS E SCHEMAS VÁLIDOS.")
    else:
        print("\n🔴 FALHA NA INTEGRIDADE.")
        
    sys.exit(ret)