#!/usr/bin/env bash
# Verify the CLI secret-plumbing invariants after a rebrand.
#
# The upstream fix (bitlatch #10) moves vault secrets off the child's
# environment and onto a pipe. Four names must agree across three files, or
# the CLI silently falls back to reading secrets from the real environment:
#
#   1. payload.ts   secretNames[]      names the proxy protects
#   2. cli.ts       --passwordenv <N>  the name the CLI reads the password from
#   3. cli.ts       secrets object key  the name the parent writes the secret under
#   4. index.ts     process.env.<N>    the fd variable naming the secret pipe
set -euo pipefail

PAYLOAD="apps/desktop/src/cli-bootstrap/payload.ts"
INDEX="apps/desktop/src/cli-bootstrap/index.ts"
CLI="apps/desktop/src/main/cli.ts"

for f in "$PAYLOAD" "$INDEX" "$CLI"; do
  [[ -f "$f" ]] || { echo "FAIL: missing $f" >&2; exit 1; }
done

fail=0
check() { # name expected actual
  if [[ "$2" == "$3" ]]; then
    echo "  ok   $1"
  else
    echo "  FAIL $1: expected '$2', got '$3'" >&2
    fail=1
  fi
}

echo "secret-plumbing invariants:"

pw_payload=$(grep -o "'[A-Z_]*MASTER_PASSWORD'" "$PAYLOAD" | tr -d "'" | head -1)
pw_cli_arg=$(grep -o "'--passwordenv', '[A-Z_]*'" "$CLI" | grep -o "'[A-Z_]*'" | tr -d "'" | head -1)
pw_cli_obj=$(grep -o "[A-Z_]*MASTER_PASSWORD:" "$CLI" | tr -d ':' | head -1)

check "cli.ts --passwordenv matches payload.ts" "$pw_payload" "$pw_cli_arg"
check "cli.ts secrets key matches payload.ts"  "$pw_payload" "$pw_cli_obj"

fd_cli=$(grep -o "[A-Z_]*_SECRET_FD:" "$CLI" | tr -d ':' | head -1)
fd_index=$(grep -o "process\.env\.[A-Z_]*_SECRET_FD" "$INDEX" | sed 's/process\.env\.//' | head -1)
check "cli.ts fd var matches index.ts" "$fd_cli" "$fd_index"

if grep -q "'BW_SESSION'" "$PAYLOAD"; then
  echo "  ok   BW_SESSION left unrenamed"
else
  echo "  FAIL BW_SESSION was renamed; it is Bitwarden's own variable" >&2
  fail=1
fi

if grep -nE '\bLATCH_|\bLatch\b|\bbitlatch\b' "$PAYLOAD" "$INDEX" "$CLI"; then
  echo "  FAIL upstream brand tokens remain in secret plumbing" >&2
  fail=1
else
  echo "  ok   no upstream brand tokens in secret plumbing"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "RESULT: FAIL" >&2
  exit 1
fi
echo "RESULT: PASS"
