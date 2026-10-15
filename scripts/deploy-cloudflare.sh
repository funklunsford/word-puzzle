#!/usr/bin/env bash
# Publish the built site (dist/) to Cloudflare Pages: the project "strokes" (made on the first run),
# which serves https://strokes.fun. From main it's the live site; from a pull request's branch, a
# preview at <branch>.strokes-f1a.pages.dev. Run by the deploy workflow, with two repository secrets:
#
#   CLOUDFLARE_API_TOKEN    a token with Account > Cloudflare Pages > Edit
#   CLOUDFLARE_ACCOUNT_ID   the Cloudflare account's ID
#
# Without them (a Dependabot pull request, say) it does nothing, with a warning.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT="${STROKES_PAGES_PROJECT:-strokes}"
# Wrangler, Cloudflare's command-line tool, at a fixed version (fetched here only, not a dependency).
WRANGLER=(npx -y wrangler@4.151.0)
# The live site from main; any other branch is a preview.
BRANCH="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-main}}"
# Plain ASCII and short: Cloudflare's API has failed on long messages with characters like "→".
MESSAGE="$(git log -1 --format=%s | sed 's/→/->/g' | LC_ALL=C tr -cd '[:print:]' | cut -c1-100)"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "::warning::Not published to Cloudflare: the CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID secrets aren't available."
  exit 0
fi
[ -f dist/index.html ] || npm run build

if ! "${WRANGLER[@]}" pages project list | grep -qw "$PROJECT"; then
  "${WRANGLER[@]}" pages project create "$PROJECT" --production-branch main
fi
"${WRANGLER[@]}" pages deploy dist --project-name "$PROJECT" --branch "$BRANCH" \
  --commit-hash "${GITHUB_SHA:-$(git rev-parse HEAD)}" --commit-message "$MESSAGE"
