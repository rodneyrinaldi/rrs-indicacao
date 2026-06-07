#!/bin/bash
# Verifica saúde de todos os containers r2 e do banco

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "═══════════════════════════════════════"
echo "  R2 — Health Check"
echo "═══════════════════════════════════════"

# ── Containers ─────────────────────────────────────────────────────────
echo ""
echo "Containers:"
docker ps --filter name=r2 --format "  {{.Names}}: {{.Status}}"

# ── PostgreSQL ─────────────────────────────────────────────────────────
echo ""
echo "PostgreSQL:"
docker exec r2-postgres pg_isready -U r2-user -d r2-database > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo -e "  Status: ${GREEN}OK${NC}"
  SIZE=$(docker exec r2-postgres psql -U r2-user -d r2-database -t -c \
    "SELECT pg_size_pretty(pg_database_size('r2-database'));" | xargs)
  echo "  Tamanho DB: $SIZE"
  TABLES=$(docker exec r2-postgres psql -U r2-user -d r2-database -t -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='r2-schema';" | xargs)
  echo "  Tabelas em r2-schema: $TABLES"
  CONNS=$(docker exec r2-postgres psql -U r2-user -d r2-database -t -c \
    "SELECT count(*) FROM pg_stat_activity WHERE datname='r2-database';" | xargs)
  echo "  Conexoes ativas: $CONNS"
else
  echo -e "  Status: ${RED}FALHOU${NC}"
fi

# ── Recursos ───────────────────────────────────────────────────────────
echo ""
echo "Recursos (containers r2):"
docker stats --no-stream --filter name=r2 \
  --format "  {{.Name}}: CPU {{.CPUPerc}} | MEM {{.MemUsage}}"

# ── Volume ─────────────────────────────────────────────────────────────
echo ""
echo "Volume r2-pgdata:"
docker volume inspect r2-pgdata --format "  Mountpoint: {{.Mountpoint}}" 2>/dev/null \
  || echo "  Volume nao encontrado"

echo ""
echo "═══════════════════════════════════════"
