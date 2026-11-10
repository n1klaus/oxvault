#!/usr/bin/env bash
# Port upstream bitlatch commits into the oxvault fork.
#
# oxvault's root commit is an orphan (no parents), so the two histories are
# unrelated and `git merge upstream-bitlatch/main` is refused by git. Every
# upstream commit must therefore be ported individually. This script automates
# the mechanical part of that port; every conflict still needs a human review.
#
# Usage: scripts/sync-upstream-bitlatch.sh [--dry-run] [--from <sha>] [--only <sha,sha,...>]
set -euo pipefail

if git rev-parse --show-toplevel >/dev/null 2>&1; then
  REPO_ROOT="$(git rev-parse --show-toplevel)"
else
  REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
cd "$REPO_ROOT"

DRY_RUN=0
FROM=""
ONLY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --from) FROM="$2"; shift 2 ;;
    --only) ONLY="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

BASE_SHA="efbe4d0ea404a8b8e198be33629617f638e66094"   # bitlatch v0.3.5, the fork point

# Brand substitutions: upstream says "latch", this fork says "oxvault".
#
# Order matters: the SCREAMING_SNAKE and mixed-case forms must be handled
# before the bare-word forms, or they survive the substitution.
#   LATCH_SECRET_FD      -> OXVAULT_SECRET_FD         (env var, set in cli.ts, read in index.ts)
#   LATCH_MASTER_PASSWORD-> OXVAULT_MASTER_PASSWORD    (env var + --passwordenv arg + secretNames entry)
#   LATCH_BW_PATH        -> OXVAULT_BW_PATH            (env var read in engine.ts)
#   LATCH_DISABLE_SERVE  -> OXVAULT_DISABLE_SERVE      (env var read in engine.ts)
#   Bitlatch             -> OxVault                    (user-facing prose)
#   bitlatch-cli-...     -> oxvault-cli-...            (BOOTSTRAP_MARKER string)
#   latch-serve-         -> oxvault-serve-             (temp dir prefix in serve.ts)
#
# BW_SESSION, BW_CLIENTID and BW_CLIENTSECRET are Bitwarden's OWN variable
# names and must never be renamed.
rebrand() {
  local in_place=(-i)
  for arg in "$@"; do
    if [[ "$arg" == "/dev/stdin" || "$arg" == "-" ]]; then
      in_place=()
      break
    fi
  done
  sed "${in_place[@]}" \
    -e 's|@latch/shared|@oxvault/shared|g' \
    -e 's|@latch/|@oxvault/|g' \
    -e 's|\bLATCH_|OXVAULT_|g' \
    -e 's|\bBitlatch\b|OxVault|g' \
    -e 's|\bbitlatch-cli-|oxvault-cli-|g' \
    -e 's|\bbitlatch\b|oxvault|g' \
    -e 's|\bLatch\b|OxVault|g' \
    -e 's|\blatch\b|oxvault|g' \
    "$@"
}

# Upstream commits to skip:
# - 5323170983e54277bc16be33d99f1937733ab0fd: Tier C, declined
# - acde94847d149a97ec847f591810be8f47eea72e, d15f89fd53437da57479d30295f3111f15fa74d5,
#   c6426f154585527038fd0a8479722f565dedaa2e: Tier D agent docs, not ported
# - 522e67e5e6d939572a7c4d78bda3dd8ae2e004e3, 2968e2f3c3eb28ff8466bf737ba207576615c697,
#   896b7fdb28f36617edbe8a9f331f935aa9053b23: Bitlatch release-prep chores, not ported
declare -A SKIP_SHAS=(
  ["5323170983e54277bc16be33d99f1937733ab0fd"]="Tier C, declined"
  ["acde94847d149a97ec847f591810be8f47eea72e"]="Tier D agent docs, not ported"
  ["d15f89fd53437da57479d30295f3111f15fa74d5"]="Tier D agent docs, not ported"
  ["c6426f154585527038fd0a8479722f565dedaa2e"]="Tier D agent docs, not ported"
  ["522e67e5e6d939572a7c4d78bda3dd8ae2e004e3"]="Bitlatch release-prep chores, not ported"
  ["2968e2f3c3eb28ff8466bf737ba207576615c697"]="Bitlatch release-prep chores, not ported"
  ["896b7fdb28f36617edbe8a9f331f935aa9053b23"]="Bitlatch release-prep chores, not ported"
)

if [[ -n "$ONLY" ]]; then
  IFS=',' read -r -a ALL_COMMITS <<< "$ONLY"
elif [[ -n "$FROM" ]]; then
  mapfile -t ALL_COMMITS < <(git rev-list --reverse "${FROM}..upstream-bitlatch/main")
else
  mapfile -t ALL_COMMITS < <(git rev-list --reverse "${BASE_SHA}..upstream-bitlatch/main")
fi

COMMITS=()
skipped_count=0
already_ported_count=0

# Capture the trailer log once before the loop. Piping `git log` straight into
# `grep -q` makes grep exit on the first match, git log dies with SIGPIPE (141),
# and under `set -o pipefail` that failure flips the test to false even when the
# trailer is present -- so only a couple of ports were ever detected as done.
ported_log="$(git log --format=%B main..HEAD)"
# NOTE: this capture must stay above the classification loop AND the port loop:
# porting creates commits that change main..HEAD, so a later capture would see
# the newly ported commits as already-done.

for sha in "${ALL_COMMITS[@]}"; do
  if [[ -n "${SKIP_SHAS[$sha]:-}" ]]; then
    echo "skipping $sha (${SKIP_SHAS[$sha]})"
    skipped_count=$((skipped_count + 1))
    continue
  fi

  # Hardcoded check: 3183a6419edc9dda0caea8bdb8a5c45dbd9451f2 is already settled
  # because its content is byte-identical in main:apps/extension/content/fields.ts
  if [[ "$sha" == "3183a6419edc9dda0caea8bdb8a5c45dbd9451f2" ]]; then
    echo "base-present $sha"
    already_ported_count=$((already_ported_count + 1))
    continue
  fi

  if grep -q "Upstream-Commit: ${sha}" <<<"$ported_log" || grep -q "Ported from dillionverma/bitlatch@${sha}" <<<"$ported_log"; then
    echo "already ported $sha"
    already_ported_count=$((already_ported_count + 1))
    continue
  fi

  COMMITS+=("$sha")
done

echo "to port: ${#COMMITS[@]}, skipped: ${skipped_count}, already ported: ${already_ported_count}"
for sha in "${COMMITS[@]}"; do
  subject="$(git show -s --format=%s "$sha")"
  echo "  $sha  $subject"
done

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo
  echo "dry run: no repository state changed."
  exit 0
fi

for sha in "${COMMITS[@]}"; do
  subject="$(git show -s --format=%s "$sha")"
  echo "=== porting $sha  $subject ==="

  git cherry-pick -n "$sha" || true
  git diff --name-only --diff-filter=U | while read -r f; do
    [[ -n "$f" ]] || continue
    case "$f" in
      assets/brand/*|apps/extension/public/*|apps/raycast/assets/*)
        # Upstream brand assets: keep this fork's branding, never overwrite.
        git checkout --ours -- "$f" 2>/dev/null || git rm -f --cached "$f" >/dev/null 2>&1 || true
        echo "    kept fork brand asset: $f"
        continue
        ;;
    esac
    if git cat-file -e "$sha:$f" 2>/dev/null; then
      git checkout "$sha" -- "$f"
      echo "    took upstream: $f"
    else
      git checkout --ours -- "$f" 2>/dev/null || true
      echo "    kept fork version (not in upstream): $f"
    fi
  done
  git add -A

  # Rebrand EVERY file the cherry-pick touched, not only the conflicted ones.
  # A commit that creates a file (e.g. cli-bootstrap/payload.ts) never conflicts,
  # so a conflict-only rebrand silently leaves upstream's LATCH_ names in place --
  # which breaks the four-way secret-name coupling while still building.
  git diff --cached --name-only | while read -r f; do
    [[ -n "$f" ]] || continue
    [[ -f "$f" ]] || continue
    case "$f" in
      assets/brand/*|apps/extension/public/*|apps/raycast/assets/*) continue ;;
      scripts/sync-upstream-bitlatch.sh) continue ;;
    esac
    case "$f" in
      *.ts|*.tsx|*.js|*.mjs|*.cjs|*.json|*.md|*.yml|*.yaml|*.css|*.html|*.swift|*.c|*.h|*.sh|*.plist|*.toml)
        rebrand "$f"
        ;;
    esac
  done
  git add -A

  if git diff --cached --quiet; then
    echo "  no net change, skipping"
    git cherry-pick --abort 2>/dev/null || git reset --hard HEAD
    continue
  fi

  git commit -m "$subject" -m "Ported from dillionverma/bitlatch@$sha" -m "Upstream-Commit: $sha"
  echo "  committed"
done

echo
echo "done. verify with: pnpm run check && pnpm run build"
