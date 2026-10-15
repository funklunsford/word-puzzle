#!/usr/bin/env bash
# The nightly run (Claude in Anthropic's cloud: docs/daily-prompt.md, "On a schedule") pushes its
# day files straight to main, and every push to main goes live. So before publishing, check every
# commit Claude pushed straight to main since the last publish: each may only add day files
# (src/daily/days-5/YYYY-MM-DD.json). Commits merged from a pull request aren't checked, since a
# person merged them.
#
# If one did more, nothing is published, on this push or later ones, until a person has looked:
# revert it or keep it, then publish by hand (GitHub > Actions > Test and deploy > Run workflow),
# which skips this check.
#
#   bash scripts/check-nightly.sh                  # in CI: GH_TOKEN finds the last publish
#   SINCE=<commit> bash scripts/check-nightly.sh   # check Claude's commits after <commit>
set -euo pipefail

since="${SINCE:-}"
if [ -z "$since" ]; then
  # The last publish: this workflow's newest successful run on main, from a push or by hand.
  since="$(gh run list --workflow deploy.yml --branch main --status success --limit 30 --json headSha,event \
    --jq '[.[] | select(.event == "push" or .event == "workflow_dispatch")][0].headSha // empty')"
fi
if [ -z "$since" ] || ! git merge-base --is-ancestor "$since" HEAD 2>/dev/null; then
  since="${BEFORE:-HEAD~1}"
  echo "No earlier publish to start from: checking from $since."
fi

DAY='^A[[:space:]]+src/daily/days-5/[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$'
bad=0
# Straight onto main: its first-parent line. Against the first parent, so a merge counts everything it brings.
for c in $(git rev-list --first-parent --author='@anthropic\.com>' "$since..HEAD"); do
  other="$(git diff --no-renames --name-status "$c^" "$c" | grep -Ev "$DAY" || true)"
  if [ -n "$other" ]; then
    bad=1
    echo "::error::$(git log -1 --format='%h %s' "$c") changes more than new day files:"
    echo "$other"
  fi
done
if [ "$bad" = 1 ]; then
  echo "Not published. Revert those changes or keep them, then publish by hand: Actions > Test and deploy > Run workflow."
  exit 1
fi
echo "Claude's commits on main since $(git rev-parse --short "$since"): only new day files."
