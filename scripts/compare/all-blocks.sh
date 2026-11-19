#!/usr/bin/env bash
# Runs blocks.ts on every page at the given widths and prints each page's count of blocks that are off.
cd "$(dirname "$0")/../.."
for w in ${WIDTHS:-1440 390}; do
  for p in / /day-learning-program /summer-program /community-chapters /golden-bridge-project /blue-bridge-project /california-schools-fire-relief-project /voices-of-the-vulnerable /mentors-corner /our-team /resources /support-us /founder-message; do
    printf '%-42s %5s  ' "$p" "$w"
    npx tsx scripts/compare/blocks.ts --page "$p" --width "$w" 2>&1 | tail -1
  done
done
