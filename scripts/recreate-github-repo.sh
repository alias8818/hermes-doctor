#!/usr/bin/env bash
# Recreate alias8818/hermes-doctor on GitHub and push clean history.
# Prereq: gh auth login (or valid GITHUB_TOKEN with repo scope)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OWNER_REPO="alias8818/hermes-doctor"
TAG="v0.1.2"

if ! gh auth status -h github.com &>/dev/null; then
  echo "Run: gh auth login -h github.com"
  exit 1
fi

if gh repo view "$OWNER_REPO" &>/dev/null; then
  echo "Repo $OWNER_REPO already exists — pushing only."
else
  echo "Creating public repo $OWNER_REPO ..."
  gh repo create "$OWNER_REPO" --public --description "Local-first health checker CLI for Hermes Agent" \
    --source=. --remote=origin --push=false
fi

git remote set-url origin "https://github.com/${OWNER_REPO}.git"
git push -u origin main --force
git push origin "$TAG" --force

if gh release view "$TAG" &>/dev/null; then
  echo "Release $TAG exists; skipping create."
else
  gh release create "$TAG" \
    --title "v0.1.2" \
    --notes "Hermes Doctor 0.1.2 — npm package unchanged. Repository history reset after accidental fixture leak; all exposed credentials rotated or revoked."
fi

echo "Done: https://github.com/${OWNER_REPO}"
