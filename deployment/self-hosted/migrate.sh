#!/bin/sh
set -eu

export PGPASSWORD="${POSTGRES_PASSWORD}"
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-hi5central}"
DB_USER="${POSTGRES_USER:-hi5central}"

psql_base() {
  psql \
    --host "$DB_HOST" \
    --port "$DB_PORT" \
    --username "$DB_USER" \
    --dbname "$DB_NAME" \
    --set ON_ERROR_STOP=1 \
    "$@"
}

psql_base <<'SQL'
CREATE TABLE IF NOT EXISTS hi5_schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

for file in /migrations/*.sql; do
  [ -f "$file" ] || continue
  filename="$(basename "$file")"
  already="$(psql_base --tuples-only --no-align --command "SELECT 1 FROM hi5_schema_migrations WHERE filename = '${filename}' LIMIT 1")"

  if [ "$already" = "1" ]; then
    echo "skip  $filename"
    continue
  fi

  echo "apply $filename"
  psql_base --single-transaction \
    --file "$file" \
    --command "INSERT INTO hi5_schema_migrations (filename) VALUES ('${filename}')"
done

echo "Hi5Central database migrations complete."
