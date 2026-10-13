#!/usr/bin/env bash
# One-time setup so every push to main publishes the site (see .github/workflows/deploy.yml).
#
#   bash scripts/setup-deploy-key.sh
#
# Makes a new SSH key, adds its public half to the site's repo as a deploy key that can push, and
# stores the private half as the STROKES_DEPLOY_KEY secret of this repo. The key is deleted from
# this machine afterwards. Needs the GitHub CLI, logged in as an owner of both repos.
set -euo pipefail
cd "$(dirname "$0")/.." # this repo, wherever it's run from

SITE="${STROKES_REPO:-funklunsford/strokes}"
SOURCE="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT

ssh-keygen -q -t ed25519 -N "" -C "deploy from ${SOURCE}" -f "$DIR/key"
gh repo deploy-key add "$DIR/key.pub" --repo "$SITE" --allow-write --title "Deploy from ${SOURCE}"
gh secret set STROKES_DEPLOY_KEY --repo "$SOURCE" <"$DIR/key"
echo "Done: every push to main in ${SOURCE} now publishes ${SITE}."
