#!/usr/bin/env bash
# Prova ponta a ponta contra o Worker e o D1 local.
# Suba o Worker antes:  bunx wrangler dev --port 8787 --local
# Depois rode:          bash scripts/smoke.sh
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:8787}"
JAR="$(mktemp)"
EMAIL="smoke-$(date +%s)@exemplo.com.br"
SENHA="senha-bem-comprida-123"

q() { python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$1"; }
pick() { python3 -c "import json,sys;print(eval('json.load(sys.stdin)'+sys.argv[1]))" "$1"; }
ok() { printf '  ok  %s\n' "$1"; }
fail() { printf '  FALHOU  %s\n' "$1"; exit 1; }

echo "1. saude"
[ "$(curl -s "$BASE/api/health")" = '{"status":"ok"}' ] || fail "health"
ok "health responde"

echo "2. portão de cadastro"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/sign-up/email" \
  -H 'content-type: application/json' \
  -d '{"name":"Intruso","email":"intruso@gmail.com","password":"'"$SENHA"'"}')
[ "$code" = "403" ] || fail "email fora da lista deveria dar 403, deu $code"
ok "ALLOWED_SIGN_IN recusa email de fora"

echo "3. cadastro e sessão"
curl -s -c "$JAR" -X POST "$BASE/api/auth/sign-up/email" -H 'content-type: application/json' \
  -d '{"name":"Ana Souza","email":"'"$EMAIL"'","password":"'"$SENHA"'"}' > /dev/null
ws=$(curl -s -b "$JAR" "$BASE/api/trpc/workspace.get" | pick "['result']['data']['id']")
[ "$ws" = "workspace" ] || fail "workspace singleton não apareceu"
ok "cadastro entra e o workspace singleton existe"

echo "4. empresa com acento"
co=$(curl -s -b "$JAR" -X POST "$BASE/api/trpc/companies.create" -H 'content-type: application/json' \
  -d '{"name":"Padaria São José","domain":"https://www.saojose.com.br/","source":"MANUAL"}')
dom=$(echo "$co" | pick "['result']['data']['domain']")
cid=$(echo "$co" | pick "['result']['data']['id']")
[ "$dom" = "saojose.com.br" ] || fail "domínio não foi normalizado: $dom"
ok "domínio normalizado de URL para $dom"

echo "5. busca sem acento"
n=$(curl -s -b "$JAR" "$BASE/api/trpc/companies.list?input=$(q '{"search":"sao jose","archived":false,"direction":"desc","take":50}')" | pick "['result']['data']['total']")
[ "$n" = "1" ] || fail "busca sem acento achou $n"
ok "'sao jose' acha 'Padaria São José'"

echo "6. domínio duplicado"
err=$(curl -s -b "$JAR" -X POST "$BASE/api/trpc/companies.create" -H 'content-type: application/json' \
  -d '{"name":"Clone","domain":"saojose.com.br","source":"MANUAL"}' | pick "['error']['data']['code']")
[ "$err" = "CONFLICT" ] || fail "duplicata deveria dar CONFLICT, deu $err"
ok "domínio duplicado ativo dá CONFLICT"

echo "7. trava otimista"
v=$(curl -s -b "$JAR" -X POST "$BASE/api/trpc/companies.update" -H 'content-type: application/json' \
  -d '{"id":"'"$cid"'","version":0,"data":{"city":"Recife"}}' | pick "['result']['data']['version']")
[ "$v" = "1" ] || fail "versão deveria virar 1, virou $v"
err=$(curl -s -b "$JAR" -X POST "$BASE/api/trpc/companies.update" -H 'content-type: application/json' \
  -d '{"id":"'"$cid"'","version":0,"data":{"city":"Fortaleza"}}' | pick "['error']['data']['code']")
[ "$err" = "CONFLICT" ] || fail "versão velha deveria dar CONFLICT, deu $err"
ok "versão velha é recusada"

echo "8. dinheiro em centavos"
me=$(curl -s -b "$JAR" "$BASE/api/trpc/workspace.members" | pick "['result']['data'][0]['user']['id']")
deal=$(curl -s -b "$JAR" -X POST "$BASE/api/trpc/deals.create" -H 'content-type: application/json' \
  -d '{"name":"Painel Shopping Centro","companyId":"'"$cid"'","ownerId":"'"$me"'","stage":"DEMO_BOOKED","amount":1250000,"currency":"BRL"}')
amount=$(echo "$deal" | pick "['result']['data']['amount']")
did=$(echo "$deal" | pick "['result']['data']['id']")
[ "$amount" = "1250000" ] || fail "valor gravado errado: $amount"
ok "R\$ 12.500,00 gravado como 1250000 centavos"

echo "9. mudança de etapa gera atividade"
curl -s -b "$JAR" -X POST "$BASE/api/trpc/deals.moveStage" -H 'content-type: application/json' \
  -d '{"id":"'"$did"'","version":0,"stage":"CONTRACT_SENT"}' > /dev/null
kind=$(curl -s -b "$JAR" "$BASE/api/trpc/activities.timeline?input=$(q '{"dealId":"'"$did"'","take":30}')" | pick "['result']['data']['rows'][0]['type']")
[ "$kind" = "STAGE_CHANGE" ] || fail "atividade não foi criada: $kind"
ok "STAGE_CHANGE registrado na linha do tempo"

echo "10. purga em lote atômico"
curl -s -b "$JAR" -X POST "$BASE/api/trpc/companies.purge" -H 'content-type: application/json' \
  -d '{"id":"'"$cid"'"}' > /dev/null
deals=$(curl -s -b "$JAR" "$BASE/api/trpc/deals.list?input=$(q '{"archived":false,"direction":"desc","take":50}')" | pick "['result']['data']['total']")
[ "$deals" = "0" ] || fail "negócio sobrou após a purga: $deals"
ok "purgar a empresa levou o negócio junto"

echo
echo "Todas as 10 provas passaram."
