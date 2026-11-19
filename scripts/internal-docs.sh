#!/usr/bin/env bash
# The private notes, docs/internal/: a copy of the private repository Hyber-Tec/Eclipse (HyberTec's notes for the
# owner's clients, EduBud's in EduBud/), kept inside this folder, which git-ignores it (CLAUDE.md, "Local files").
# Claude Code runs this when a session starts (.claude/settings.json), so a session on one computer reads what a
# session on another wrote:
#   - a copy that's there catches up with GitHub, when nothing here is in the way (never a merge);
#   - with none yet, one is made, when this computer's GitHub login can read the repository (without access, nothing
#     happens, and no password is asked for);
#   - a folder of notes that isn't a copy is left as it is, with a line saying so.
# It prints a line, which the session reads, only when there's something to do, and it never fails the session.
set -u
cd "$(dirname "$0")/.." 2>/dev/null || exit 0
dir=docs/internal
url=https://github.com/Hyber-Tec/Eclipse.git
say() { echo "Private notes ($dir/): $*"; }
# No password prompt, in the terminal or in a window, and no wait on a stalled connection.
export GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never
quiet() { git -c credential.interactive=never -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=10 "$@" >/dev/null 2>&1; }

if [ -d "$dir/.git" ]; then
  if quiet -C "$dir" fetch --quiet origin && ! quiet -C "$dir" merge --ff-only '@{u}'; then
    say "can't catch up with GitHub by itself (changes both here and there): pull and push it by hand, as its README says."
  fi
  if [ -n "$(git -C "$dir" status --porcelain 2>/dev/null)" ] || [ "$(git -C "$dir" rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)" != 0 ]; then
    say "has changes that aren't on GitHub yet: commit and push them (its README), so other computers see them."
  fi
elif [ -z "$(ls -A "$dir" 2>/dev/null)" ]; then
  if quiet ls-remote "$url" HEAD && quiet clone --quiet "$url" "$dir"; then
    say "copied from GitHub ($url): read its README.md, then EduBud/README.md."
  fi
else
  say "holds notes but isn't a copy of $url: move them out, clone the repository here, and put them back."
fi
exit 0
