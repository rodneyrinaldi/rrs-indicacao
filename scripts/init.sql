-- Executado automaticamente na primeira criacao do volume
CREATE SCHEMA IF NOT EXISTS indicacao;
GRANT ALL PRIVILEGES ON SCHEMA indicacao TO "r2-user";
ALTER USER "r2-user" SET search_path TO indicacao, public;
