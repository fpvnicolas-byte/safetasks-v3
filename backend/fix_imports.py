import os
import ast

# Caminho para a pasta de modelos
models_dir = "app/models"

print(f"🕵️  ESCANANDO A PASTA: {models_dir} ...\n")

found_imports = []
found_classes = []

# Lista de arquivos ignorados
ignored_files = ["__init__.py", "__pycache__"]

try:
    files = [f for f in os.listdir(models_dir) if f.endswith(".py") and f not in ignored_files]
except FileNotFoundError:
    print(f"❌ Erro: Pasta '{models_dir}' não encontrada. Rode dentro de 'backend'.")
    exit()

for filename in sorted(files):
    module_name = filename[:-3] # Remove .py
    file_path = os.path.join(models_dir, filename)
    
    with open(file_path, "r", encoding="utf-8") as f:
        try:
            tree = ast.parse(f.read())
            classes_in_file = [
                node.name for node in ast.walk(tree) 
                if isinstance(node, ast.ClassDef) 
                and "Base" not in node.name # Ignora classes internas de configuração
            ]
            
            if classes_in_file:
                # Monta a linha de importação correta
                classes_str = ", ".join(classes_in_file)
                import_line = f"from .{module_name} import {classes_str}"
                found_imports.append(import_line)
                found_classes.extend(classes_in_file)
                print(f"✅ Encontrado em '{filename}': {classes_str}")
        except Exception as e:
            print(f"⚠️  Erro ao ler {filename}: {e}")

# Gera o conteúdo final
print("\n" + "="*50)
print("📄 COPIE O CÓDIGO ABAIXO PARA: backend/app/models/__init__.py")
print("="*50 + "\n")

final_code = "# Import all models automatically detected\n"
final_code += "\n".join(found_imports)
final_code += "\n\n__all__ = [\n"
for cls in found_classes:
    final_code += f'    "{cls}",\n'
final_code += "]\n"

print(final_code)
print("="*50)