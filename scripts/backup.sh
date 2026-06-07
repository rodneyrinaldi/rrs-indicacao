#!/bin/bash
# Uso: bash scripts/backup.sh [prod]
# Sem argumento: usa .env.dev | com 'prod': usa .env.prod.local

ENV=${1:-dev}
ENV_FILE=".env.$ENV"
[ "$ENV" = "prod" ] && ENV_FILE=".env.prod.local"

set -o allexport
source $ENV_FILE
set +o allexport

CONTAINER="r2-postgres"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/r2-database_${ENV}_${TIMESTAMP}.sql"

mkdir -p $BACKUP_DIR

echo "=> Backup iniciado: $FILE"
docker exec $CONTAINER pg_dump \
  -U $DB_USER \
  -d $DB_NAME \
  --schema=$DB_SCHEMA \
  --no-owner \
  --no-acl \
  > $FILE

if [ $? -eq 0 ]; then
  gzip $FILE
  echo "=> OK: ${FILE}.gz ($(du -sh ${FILE}.gz | cut -f1))"
else
  echo "=> ERRO: backup falhou"
  exit 1
fi
