import glob
import os

# Caminho para os endpoints
path = "app/api/v1/endpoints/*.py"
files = glob.glob(path)

print(f"🔎 INICIANDO AUDITORIA EM {len(files)} ARQUIVOS...\n")

issues_found = []

for filepath in files:
    with open(filepath, "r") as f:
        content = f.read()
        
        # Verifica se o arquivo tenta usar a dependência
        uses_profile = "Depends(get_current_profile)" in content
        
        # Verifica se o arquivo importa a dependência
        has_import = "get_current_profile" in content and "from app.api.deps import" in content
        
        # Lógica: Se usa, TEM que importar.
        # (A verificação has_import é simples, mas pega 99% dos casos de esquecimento)
        if uses_profile:
            # Precisamos checar se 'get_current_profile' aparece nas linhas de importação
            lines = content.split('\n')
            import_found = False
            for line in lines:
                if "from app.api.deps import" in line and "get_current_profile" in line:
                    import_found = True
                    break
            
            if not import_found:
                print(f"❌ ERRO ENCONTRADO: {filepath}")
                print(f"   -> Usa 'Depends(get_current_profile)' mas NÃO importa a função.")
                issues_found.append(filepath)

if not issues_found:
    print("\n✅ TUDO LIMPO! Nenhum arquivo com import faltando foi detectado.")
    print("Pode tentar subir o servidor.")
else:
    print(f"\n⚠️ FORAM ENCONTRADOS {len(issues_found)} ARQUIVOS COM PROBLEMA.")
    print("Adicione ', get_current_profile' na linha 'from app.api.deps import ...' desses arquivos.")