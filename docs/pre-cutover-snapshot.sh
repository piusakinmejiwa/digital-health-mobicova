#!/usr/bin/env bash
# =============================================================================
# Pre-cutover database snapshot — a provider-independent, VERIFIED backup of the
# live Supabase Postgres, taken before migrating to Nobus. Read-only on the source
# (pg_dump never writes to the database). Produces:
#   • a compressed custom-format dump  → restore into Nobus with pg_restore
#   • a schema-only .sql               → quick human-readable structure check
#
# Requires: pg_dump + pg_restore (PostgreSQL 16 client tools, to match the DB).
#
# Connection: use the SESSION-mode pooler URL. The transaction pooler (:6543) does
# NOT support pg_dump. In Supabase → Project Settings → Database → Connection string
# → "Session pooler" (host …pooler.supabase.com, port 5432). The direct host is
# IPv6-only here, so the pooler is the way in.
#
# Usage:
#   SUPABASE_DB_URL='postgresql://postgres.<ref>:<pwd>@aws-1-eu-west-2.pooler.supabase.com:5432/postgres' \
#     bash docs/pre-cutover-snapshot.sh
# =============================================================================
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the Supabase SESSION-pooler connection string (port 5432)}"
command -v pg_dump    >/dev/null 2>&1 || { echo "pg_dump not found — install postgresql-client (v16)"; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "pg_restore not found — install postgresql-client (v16)"; exit 1; }

STAMP="$(date -u +%Y%m%d-%H%M%SZ)"          # UTC, so snapshots sort chronologically
OUTDIR="${OUTDIR:-./db-snapshots}"
mkdir -p "$OUTDIR"
DUMP="$OUTDIR/mobicova-$STAMP.dump"          # custom format, for pg_restore
SCHEMA="$OUTDIR/mobicova-$STAMP.schema.sql"  # schema only, for review/diffing

# We migrate the application's own tables (the public schema); Supabase's internal
# auth/storage schemas are not carried over to a vanilla Postgres. --no-owner /
# --no-privileges strip Supabase-specific roles so it restores cleanly into Nobus.
echo "== 1/3  Full data + schema dump (custom format) =="
pg_dump "$SUPABASE_DB_URL" \
  --format=custom --no-owner --no-privileges --schema=public --verbose \
  --file="$DUMP"

echo "== 2/3  Schema-only reference =="
pg_dump "$SUPABASE_DB_URL" \
  --schema-only --no-owner --no-privileges --schema=public \
  --file="$SCHEMA"

echo "== 3/3  Verify the dump is readable =="
OBJECTS="$(pg_restore --list "$DUMP" | grep -cE '^[0-9]+;' || true)"
TABLES="$(pg_restore --list "$DUMP" | grep -c ' TABLE DATA ' || true)"
SIZE="$(du -h "$DUMP" | cut -f1)"
[ "${OBJECTS:-0}" -ge 1 ] || { echo "FAIL: dump contains no objects — check the connection string"; exit 1; }

echo
echo "Snapshot OK"
echo "  dump    : $DUMP  ($SIZE)"
echo "  objects : $OBJECTS   (tables with data: $TABLES)"
echo "  schema  : $SCHEMA"
echo
echo "Restore into Nobus Managed PostgreSQL with:"
echo "  pg_restore --no-owner --no-privileges --dbname=\"\$NOBUS_DB_URL\" \"$DUMP\""
echo
echo "Keep this snapshot until the Nobus cutover is validated. Store it securely"
echo "(in-Nigeria) or delete it per your data-residency policy once no longer needed."
