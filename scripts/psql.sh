#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${PG_BIN_DIR:-}" && -x "${PG_BIN_DIR}/psql" ]]; then
  exec "${PG_BIN_DIR}/psql" "$@"
fi

if [[ -x "/Users/briandavidson/Applications/Postgres.app/Contents/Versions/16/bin/psql" ]]; then
  exec "/Users/briandavidson/Applications/Postgres.app/Contents/Versions/16/bin/psql" "$@"
fi

if command -v psql >/dev/null 2>&1; then
  exec psql "$@"
fi

echo "psql not found. Install Postgres.app or set PG_BIN_DIR." >&2
exit 1
