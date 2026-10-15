#!/usr/bin/env bash
# Publish the built site (dist/) to Cloudflare Pages, as the project "strokes" (created the first
# time). Run by the deploy workflow after the GitHub Pages publish, with two repository secrets:
#
#   CLOUDFLARE_API_TOKEN    a token with Account > Cloudflare Pages > Edit
#   CLOUDFLARE_ACCOUNT_ID   the Cloudflare account's ID
#
# Until both are set it does nothing (with a warning), so the workflow still passes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT="${STROKES_PAGES_PROJECT:-strokes}"
# Wrangler, Cloudflare's command-line tool, at a fixed version (fetched here only, not a dependency).
WRANGLER=(npx -y wrangler@4.151.0)

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "::warning::Not published to Cloudflare: the CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID secrets aren't set yet (docs/launch-plan.md)."
  exit 0
fi
[ -f dist/index.html ] || npm run build

if ! "${WRANGLER[@]}" pages project list | grep -qw "$PROJECT"; then
  "${WRANGLER[@]}" pages project create "$PROJECT" --production-branch main
fi
"${WRANGLER[@]}" pages deploy dist --project-name "$PROJECT" --branch main \
  --commit-hash "${GITHUB_SHA:-$(git rev-parse HEAD)}" --commit-message "$(git log -1 --format=%s)"
