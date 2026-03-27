-- Wipe all OpenRAG rows but keep schema (pgvector extension + tables).
-- Run from host:
--   docker compose exec -T db psql -U openrag -d openrag -f - < scripts/reset_data.sql
-- Or:
--   docker compose exec -T db psql -U openrag -d openrag -c "TRUNCATE TABLE users RESTART IDENTITY CASCADE;"

TRUNCATE TABLE users RESTART IDENTITY CASCADE;
