#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
ACCESS_TOKEN="${ACCESS_TOKEN:-}"
AI_CHECK="${AI_CHECK:-0}"

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

http_request() {
  local url="$1"
  shift
  local response
  response="$(curl -sS -w "\n%{http_code}" "$@" "$url" || true)"
  HTTP_BODY="${response%$'\n'*}"
  HTTP_CODE="${response##*$'\n'}"
}

echo "Smoke test against: $BASE_URL"

echo "GET /health"
http_request "$BASE_URL/health"
if [[ "$HTTP_CODE" != "200" ]]; then
  fail "Health check failed (HTTP $HTTP_CODE)"
fi
if ! echo "$HTTP_BODY" | grep -q "\"status\""; then
  fail "Health check response missing status"
fi
echo "OK /health"

if [[ -z "$ACCESS_TOKEN" ]]; then
  echo "WARN: ACCESS_TOKEN not set; skipping authenticated checks."
  exit 0
fi

auth_header=(-H "Authorization: Bearer $ACCESS_TOKEN")

echo "GET /api/v1/profiles/me"
http_request "$BASE_URL/api/v1/profiles/me" "${auth_header[@]}"
if [[ "$HTTP_CODE" != "200" ]]; then
  fail "profiles/me failed (HTTP $HTTP_CODE)"
fi
echo "OK profiles/me"

echo "GET /api/v1/organizations/me"
http_request "$BASE_URL/api/v1/organizations/me" "${auth_header[@]}"
if [[ "$HTTP_CODE" != "200" ]]; then
  fail "organizations/me failed (HTTP $HTTP_CODE)"
fi
echo "OK organizations/me"

echo "GET /api/v1/billing/usage"
http_request "$BASE_URL/api/v1/billing/usage" "${auth_header[@]}"
if [[ "$HTTP_CODE" != "200" ]]; then
  fail "billing/usage failed (HTTP $HTTP_CODE)"
fi
echo "OK billing/usage"

if [[ "$AI_CHECK" == "1" ]]; then
  echo "GET /api/v1/ai/monitoring/status"
  http_request "$BASE_URL/api/v1/ai/monitoring/status" "${auth_header[@]}"
  if [[ "$HTTP_CODE" != "200" ]]; then
    fail "ai/monitoring/status failed (HTTP $HTTP_CODE)"
  fi
  echo "OK ai/monitoring/status"
fi

echo "Smoke test complete"
