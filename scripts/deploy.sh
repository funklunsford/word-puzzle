#!/usr/bin/env bash
# Publish the built game to GitHub Pages: only the site files, never the source.
#
#   npm run deploy        # → https://funklunsford.github.io/strokes/
#
# Builds, and force-pushes the result as a single commit to the public repo below (creating it
# and turning on Pages the first time).
#
# Every push to main runs this in GitHub Actions (.github/workflows/deploy.yml), with DEPLOY_KEY
# set to an SSH key that can push to that repo (scripts/setup-deploy-key.sh adds one). Run by
# hand, it needs the GitHub CLI, logged in (`gh auth login`).
set -euo pipefail

REPO="${STROKES_REPO:-funklunsford/strokes}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build

# The built site, plus what only GitHub Pages needs: no Jekyll, and a README for its repo. (The
# licence notices the word list and definitions require ship in every build: public/licenses.)
SITE_URL="$(sed -n 's/^VITE_SITE_URL=//p' .env)"
SITE="$(mktemp -d)"
cp -R dist/. "$SITE"
touch "$SITE/.nojekyll" # serve files as they are
{
  printf '# Strokes\n\nA word maze where every letter is built from pen strokes. Play it at %s\n\n' "$SITE_URL"
  cat <<'MD'
This repository holds only the built site, published from a separate source project.

- Word list derived from [SCOWL](https://wordlist.aspell.net) by Kevin Atkinson (notice in `licenses/SCOWL.txt`) and ENABLE (public domain).
- Definitions from [WordNet](https://wordnet.princeton.edu) 3.0, Copyright 2006 by Princeton University (licence in `licenses/WORDNET.txt`), with hand-written additions.
MD
} > "$SITE/README.md"
if [ -n "${DEPLOY_KEY:-}" ]; then
  # In CI: git pushes over SSH with the deploy key, and commits as the GitHub Actions bot.
  KEY="$(mktemp)"
  trap 'rm -f "$KEY"' EXIT
  printf '%s\n' "$DEPLOY_KEY" >"$KEY"
  chmod 600 "$KEY"
  export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  export GIT_AUTHOR_NAME='github-actions[bot]' GIT_AUTHOR_EMAIL='41898282+github-actions[bot]@users.noreply.github.com'
  export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME" GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
  REMOTE="git@github.com:${REPO}.git"
  AUTH=()
  EXISTS=true
else
  # By hand: git authenticates with the GitHub CLI's login for these commands only (git's settings
  # are untouched).
  REMOTE="https://github.com/${REPO}.git"
  AUTH=(-c credential.helper= -c 'credential.helper=!gh auth git-credential')
  EXISTS="$(gh repo view "$REPO" >/dev/null 2>&1 && echo true || echo false)"
fi
# Keep the live version's scripts and styles too: GitHub Pages lets browsers cache index.html for
# 10 minutes, and one still holding the old page would otherwise ask for files that are gone.
if [ "$EXISTS" = true ]; then
  LIVE="$(mktemp -d)"
  git ${AUTH[@]+"${AUTH[@]}"} clone -q --depth 1 "$REMOTE" "$LIVE"
  for f in $(grep -o 'assets/[^"]*' "$LIVE/index.html" 2>/dev/null || true); do
    [ -e "$SITE/$f" ] || cp "$LIVE/$f" "$SITE/$f"
  done
fi
SOURCE="$(git rev-parse --short HEAD)"
cd "$SITE"
git init -q -b main
git add -A
if [ -n "${DEPLOY_KEY:-}" ]; then
  git commit -q -m "Deploy Strokes (source ${SOURCE})"
else
  git commit -q -m "Deploy Strokes (source ${SOURCE})

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
fi

if [ "$EXISTS" != true ]; then
  gh repo create "$REPO" --public --description "Strokes: a word maze where every letter is built from pen strokes"
fi
git ${AUTH[@]+"${AUTH[@]}"} push -q --force "$REMOTE" main
if [ -z "${DEPLOY_KEY:-}" ] && ! gh api "repos/${REPO}/pages" >/dev/null 2>&1; then
  gh api -X POST "repos/${REPO}/pages" -f 'source[branch]=main' -f 'source[path]=/' >/dev/null
fi

echo "Published: https://${REPO%%/*}.github.io/${REPO##*/}/ (GitHub may take a minute to update it)"
