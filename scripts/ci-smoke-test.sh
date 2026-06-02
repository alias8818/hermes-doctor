#!/usr/bin/env bash
set -euo pipefail

# Hermes Doctor CI Smoke Test
#
# Packs the CLI package, verifies no workspace:* deps,
# installs from tarball in a temp directory, and runs
# against the golden fixture.
#
# Exits non-zero on any failure (CI gate).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== CI Smoke Test ==="
echo "Root: $REPO_ROOT"

# ---------------------------------------------------------------------------
# Step 1: Pack the CLI package
# ---------------------------------------------------------------------------
echo ""
echo "--- Step 1: pnpm pack ./packages/cli ---"
cd "$REPO_ROOT/packages/cli"

# Remove any previous tarball
rm -f hermes-doctor-*.tgz

PACK_OUTPUT=$(pnpm pack 2>&1)
echo "$PACK_OUTPUT"

# Extract the tarball name from output
TARBALL=$(echo "$PACK_OUTPUT" | grep -E '\.tgz$' | tail -1)

if [ -z "$TARBALL" ]; then
  echo "ERROR: pnpm pack did not produce a tarball"
  exit 1
fi

if [ ! -f "$TARBALL" ]; then
  echo "ERROR: Tarball $TARBALL not found"
  exit 1
fi

echo "Created tarball: $TARBALL"

# ---------------------------------------------------------------------------
# Step 2: Verify no workspace:* deps in the packed manifest
# ---------------------------------------------------------------------------
echo ""
echo "--- Step 2: Verify no workspace:* dependencies ---"

# Extract package.json from tarball
TARBALL_CONTENTS=$(mktemp -d)
trap "rm -rf $TARBALL_CONTENTS" EXIT

tar -xzf "$TARBALL" -C "$TARBALL_CONTENTS"

PACKED_PKG="$TARBALL_CONTENTS/package/package.json"

if [ ! -f "$PACKED_PKG" ]; then
  echo "ERROR: package.json not found in tarball"
  exit 1
fi

if grep -q 'workspace:' "$PACKED_PKG"; then
  echo "ERROR: workspace:* protocol found in packed package.json:"
  grep 'workspace:' "$PACKED_PKG" || true
  echo ""
  echo "Packed package.json contents:"
  cat "$PACKED_PKG"
  exit 1
fi

echo "OK: No workspace:* deps found in packed package.json"

# ---------------------------------------------------------------------------
# Step 3: Install from tarball in a temp directory (no workspace symlinks)
# ---------------------------------------------------------------------------
echo ""
echo "--- Step 3: Install from tarball in temp directory ---"

SMOKE_DIR=$(mktemp -d)
trap "rm -rf $TARBALL_CONTENTS $SMOKE_DIR" EXIT

cd "$SMOKE_DIR"

npm init -y > /dev/null 2>&1
npm install "$REPO_ROOT/packages/cli/$TARBALL" 2>&1

echo "OK: CLI installed successfully in $SMOKE_DIR"

# Verify the CLI binary is installed
if [ ! -f "node_modules/hermes-doctor/dist/index.js" ]; then
  echo "ERROR: hermes-doctor CLI binary not found after install"
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 4: Run CLI via npx against golden fixture
# ---------------------------------------------------------------------------
echo ""
echo "--- Step 4: Run hermes-doctor scan against golden fixture ---"

GOLDEN_FIXTURE="$REPO_ROOT/fixtures/hermes-good"

if [ ! -d "$GOLDEN_FIXTURE" ]; then
  echo "ERROR: Golden fixture not found at $GOLDEN_FIXTURE"
  exit 1
fi

# Write scan output to a temp file (avoids ANSI + pipefail issues in captured variables)
SCAN_LOG=$(mktemp)
npx hermes-doctor scan --hermes-home "$GOLDEN_FIXTURE" > "$SCAN_LOG" 2>&1
cat "$SCAN_LOG"

# Verify scan succeeded - check for report sections
if ! grep -q "Hermes Doctor" "$SCAN_LOG"; then
  echo "ERROR: CLI did not produce a valid health report"
  rm -f "$SCAN_LOG"
  exit 1
fi

if ! grep -q "Summary" "$SCAN_LOG"; then
  echo "ERROR: Report missing Summary section"
  rm -f "$SCAN_LOG"
  exit 1
fi

if ! grep -qE "OK|Info|Warning|Broken|Risk" "$SCAN_LOG"; then
  echo "ERROR: Report missing finding categories"
  rm -f "$SCAN_LOG"
  exit 1
fi

rm -f "$SCAN_LOG"

echo ""
echo "OK: CLI scan against golden fixture completed successfully"
echo ""
echo "=== CI Smoke Test PASSED ==="
exit 0
