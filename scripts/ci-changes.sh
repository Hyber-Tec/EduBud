#!/usr/bin/env bash
# What CI checks and deploys for this change: a pull request's files against main (the first parent of its merge
# commit), a push's against the commit before it, and everything for a run started by hand or when the files can't be
# listed. Hyber-Tec's rules for GitHub Actions: check only what a change touches; docs alone run the repository guard
# only; a file this script doesn't know counts as code; a change to CI itself, or to this script, runs everything.
#
#   bash scripts/ci-changes.sh                  # in CI (EVENT, and BEFORE on a push)
#   bash scripts/ci-changes.sh --base <ref>     # what CI would do for HEAD against <ref>, e.g. origin/main
#
# Prints why, and writes to GITHUB_OUTPUT (and the run's summary):
#   code=true|false     the checks (none yet beyond the guard: the website's typecheck, tests and build come with it)
#   hosting=true|false  Hosting deploys: main goes live, a pull request gets its preview link
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

base=""
if [ "${1:-}" = "--base" ]; then base="${2:-}"; fi

everything=""
if [ -z "$base" ]; then
  case "${EVENT:-}" in
    pull_request) base="HEAD^1" ;;
    push)
      before="${BEFORE:-}"
      if ! [[ "$before" =~ ^[0-9a-f]{40}$ ]] || [[ "$before" =~ ^0+$ ]]; then
        everything="a push with no commit before it"
      elif ! git merge-base --is-ancestor "$before" HEAD 2>/dev/null; then
        everything="the commit before it (${before:0:7}) isn't in its history"
      else
        base="$before"
      fi
      ;;
    "") everything="no event (EVENT) or --base given" ;;
    *) everything="a ${EVENT} run checks and deploys everything" ;;
  esac
fi

files=""
if [ -z "$everything" ]; then
  if ! files="$(git diff --name-only --no-renames "$base" HEAD 2>/dev/null)"; then
    everything="the changed files against $base couldn't be listed"
  fi
fi

code=false
hosting=false
why_code=""
why_hosting=""
if [ -n "$everything" ]; then
  code=true
  hosting=true
  why_code="$everything"
  why_hosting="$everything"
else
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      # CI itself and what Hosting serves from: everything.
      .github/workflows/*|scripts/ci-changes.sh|firebase.json|.firebaserc)
        code=true; hosting=true
        why_code="${why_code:-$f}"; why_hosting="${why_hosting:-$f}" ;;
      # What Hosting serves.
      public/*)
        code=true; hosting=true
        why_code="${why_code:-$f}"; why_hosting="${why_hosting:-$f}" ;;
      # Docs and settings that change nothing that runs: the repository guard alone.
      docs/*|*.md|.claude/*|.github/CODEOWNERS|.gitignore) ;;
      # Anything else is code.
      *) code=true; why_code="${why_code:-$f}" ;;
    esac
  done <<<"$files"
fi

count=$(printf '%s' "$files" | grep -c . || true)
lines="The repository guard runs for every change."
if [ -n "$everything" ]; then
  lines="$lines
Everything is checked and deployed: $everything."
else
  lines="$lines
$count files changed against ${base}.
- Checks: $([ "$code" = true ] && echo "yes, for $why_code" || echo "no")
- Hosting (live on main, a preview link on a pull request): $([ "$hosting" = true ] && echo "yes, for $why_hosting" || echo "no")"
fi
echo "$lines"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  printf 'code=%s\nhosting=%s\n' "$code" "$hosting" >>"$GITHUB_OUTPUT"
fi
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  printf '### What this run checks and deploys\n\n%s\n' "$lines" >>"$GITHUB_STEP_SUMMARY"
fi
