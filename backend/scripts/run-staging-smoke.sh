#!/usr/bin/env bash
set -euo pipefail

# Gera um access token fresco e dispara o smoke test.
# Requer:
# - SUPABASE_URL e SUPABASE_KEY no .env (ou exportados)
# - credenciais válidas de usuário (email/senha)
# - ngrok/base URL apontando para FastAPI

if [[ -f ".env" ]]; then
  set -a
  source ".env"
  set +a
fi

SESSION_DATA=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "email": "fpv.nicolas@gmail.com",
  "password": "admin123"
}
EOF
)

ACCESS_TOKEN=$(printf "%s" "$SESSION_DATA" | jq -r '.access_token')

if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  echo "❌ Não foi possível gerar token. Saída do Supabase segue:"
  echo "$SESSION_DATA"
  exit 1
fi

export ACCESS_TOKEN
export AI_CHECK=1

if [[ -z "${BASE_URL:-}" ]]; then
  echo "⚠️ BASE_URL não definido. Use BASE_URL=https://... antes de rodar."
  exit 1
fi

echo "Token gerado. Iniciando smoke test..."
./scripts/staging_smoke_test.sh
