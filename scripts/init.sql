-- Executado automaticamente na primeira criacao do volume
CREATE SCHEMA IF NOT EXISTS "r2-schema";
GRANT ALL PRIVILEGES ON SCHEMA "r2-schema" TO "r2-user";
ALTER USER "r2-user" SET search_path TO "r2-schema", public;
