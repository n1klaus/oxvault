#!/usr/bin/env bash
# Re-render every PNG from the committed vector source.
#
# The repository ships the SVGs as the source of truth; this script
# regenerates the PNGs from assets/brand/source/flat-icon.svg.
#
#   npx --yes @resvg/resvg-js-cli --fit-width <size> <input.svg> <out.png>
#
# No build dependency is added to the workspace for this; the CLI is
# fetched on demand.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/assets/brand/source/flat-icon.svg"

render() { # out-path size
  npx --yes @resvg/resvg-js-cli --fit-width "$2" "$SRC" "$1"
  echo "  $1 ($2px)"
}

render "$ROOT/assets/brand/macos/icon-16.png" 16
render "$ROOT/assets/brand/macos/icon-32.png" 32
render "$ROOT/assets/brand/macos/icon-64.png" 64
render "$ROOT/assets/brand/macos/icon-128.png" 128
render "$ROOT/assets/brand/macos/icon-256.png" 256
render "$ROOT/assets/brand/macos/icon-512.png" 512
render "$ROOT/assets/brand/macos/icon-1024.png" 1024
render "$ROOT/apps/extension/public/icon-16.png" 16
render "$ROOT/apps/extension/public/icon-32.png" 32
render "$ROOT/apps/extension/public/icon-48.png" 48
render "$ROOT/apps/extension/public/icon-128.png" 128
render "$ROOT/apps/raycast/assets/icon.png" 512

echo "done"
