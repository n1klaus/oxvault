#!/usr/bin/env bash
# Port upstream bitlatch commits into the strongroom fork.
#
# strongroom's root commit is an orphan (no parents), so the two histories are
# unrelated and `git merge upstream-bitlatch/main` is refused by git. Every
# upstream commit must therefore be ported individually. This script automates
# the mechanical part of that port; every conflict still needs a human review.
#
# Usage: scripts/sync-upstream-bitlatch.sh [--dry-run] [--from <sha>] [--only <sha,sha,...>]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

# Brand substitutions: upstream says "latch", this fork says "strongroom".
#
# Order matters: the SCREAMING_SNAKE and mixed-case forms must be handled
# before the bare-word forms, or they survive the substitution.
#   LATCH_SECRET_FD      -> STRONGROOM_SECRET_FD      (env var, set in cli.ts, read in index.ts)
#   LATCH_MASTER_PASSWORD-> STRONGROOM_MASTER_PASSWORD (env var + --passwordenv arg + secretNames entry)
#   LATCH_BW_PATH        -> STRONGROOM_BW_PATH         (env var read in engine.ts)
#   LATCH_DISABLE_SERVE  -> STRONGROOM_DISABLE_SERVE   (env var read in engine.ts)
#   Bitlatch             -> Strongroom                 (user-facing prose)
#   bitlatch-cli-...     -> strongroom-cli-...         (BOOTSTRAP_MARKER string)
#   latch-serve-         -> strongroom-serve-          (temp dir prefix in serve.ts)
#
# BW_SESSION, BW_CLIENTID and BW_CLIENTSECRET are Bitwarden's OWN variable
# names and must never be renamed.
rebrand() {
  sed -i \
    -e 's|@latch/shared|@strongroom/shared|g' \
    -e 's|@latch/|@strongroom/|g' \
    -e 's|\bLATCH_|STRONGROOM_|g' \
    -e 's|\bBitlatch\b|Strongroom|g' \
    -e 's|\bbitlatch-cli-|strongroom-cli-|g' \
    -e 's|\bbitlatch\b|strongroom|g' \
    -e 's|\bLatch\b|Strongroom|g' \
    -e 's|\blatch\b|strongroom|g' \
    "$@"
}

if [[ -n "$ONLY" ]]; then
  IFS=',' read -r -a COMMITS <<< "$ONLY"
elif [[ -n "$FROM" ]]; then
  mapfile -t COMMITS < <(git rev-list --reverse "${FROM}..upstream-bitlatch/main")
else
  mapfile -t COMMITS < <(git rev-list --reverse "${BASE_SHA}..upstream-bitlatch/main")
fi

echo "upstream commits to port: ${#COMMITS[@]}"
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
      rebrand "$f"
      echo "    took upstream + rebranded: $f"
    else
      git checkout --ours -- "$f" 2>/dev/null || true
      echo "    kept fork version (not in upstream): $f"
    fi
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
