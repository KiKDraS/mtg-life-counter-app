#!/usr/bin/env bash
# Create a deduped GitHub issue for a failed pipeline run.
# Usage: NOTIFY_DETAILS="..." bash scripts/notify-failure.sh "<issue title>"
# Dedup: one open issue per title — re-runs don't spam; close it when fixed.
set -euo pipefail
TITLE="$1"
EXISTS="$(gh issue list --state open --search "in:title \"$TITLE\"" --json number --jq 'length')"
if [ "$EXISTS" = "0" ]; then
  gh issue create --title "$TITLE" --body "$NOTIFY_DETAILS"
else
  echo "issue already open — skipping"
fi