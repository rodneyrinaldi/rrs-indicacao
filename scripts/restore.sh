#!/bin/bash
# Uso: bash scripts/restore.sh [arquivo.sql.gz] [prod]

FILE=${1:?"Informe o arquivo de backup: bash scripts/restore.sh backup.sql.gz"}
ENV=${2:-dev}
ENV_FILE=".env.$ENV"
[ "$ENV" = "prod" ] && ENV_FILE=".env.prod.local"

set -o allexport
source $ENV_FILE
set +o allexport

CONTAINER="r2-postgres"

echo "=> Restore de $FILE no banco $DB_NAME (schema: $DB_SCHEMA)"
read -p "   Confirmar? [s/N] " confirm
[ "$confirm" != "s" ] && echo "Cancelado." && exit 0

if [[ $FILE == *.gz ]]; then
  gunzip -c $FILE | docker exec -i $CONTAINER psql -U $DB_USER -d $DB_NAME
else
  cat $FILE | docker exec -i $CONTAINER psql -U $DB_USER -d $DB_NAME
fi

[ $? -eq 0 ] && echo "=> OK: restore concluído" || echo "=> ERRO: restore falhou"
