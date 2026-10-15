#!/usr/bin/env bash
# Install every skill in this repository into the DSH skills root.
#
# The DSH filesystem skill provider discovers <root>/<name>/SKILL.md one level
# deep, so this copies each skill directory into $DSH_HOME/skills.
#
# Usage: bash scripts/install.sh [--dry-run]
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dsh_home="${DSH_HOME:-$HOME/.dsh}"
target_root="$dsh_home/skills"
dry_run="${1:-}"

if [ "$dry_run" = "--dry-run" ]; then
  echo "would install into $target_root"
fi

found=0
for dir in "$repo_root"/*/; do
  name="$(basename "$dir")"
  [ -f "$dir/SKILL.md" ] || continue
  found=$((found + 1))
  if [ "$dry_run" = "--dry-run" ]; then
    echo "  $name -> $target_root/$name"
    continue
  fi
  case "$name" in
    *[!a-z0-9-]*|'') echo "skip unexpected skill directory name: $name" >&2; continue ;;
  esac
  case "$target_root" in
    */skills) ;;
    *) echo "refusing to write outside a skills root: $target_root" >&2; exit 1 ;;
  esac
  rm -rf "${target_root:?}/${name:?}"
  mkdir -p "$target_root/$name"
  cp -R "$dir." "$target_root/$name/"
  echo "installed $name -> $target_root/$name"
done

if [ "$found" -eq 0 ]; then
  echo "no <name>/SKILL.md bundle found under $repo_root" >&2
  exit 1
fi
[ "$dry_run" = "--dry-run" ] || echo "$found skill(s) installed. Restart or open a new DSH session if a session does not pick them up."
