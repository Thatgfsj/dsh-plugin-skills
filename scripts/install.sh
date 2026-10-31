#!/usr/bin/env bash
# Install the skills of one adapted dsh version into the DSH skills root.
#
# Layout: <repo>/<dsh-version>/<skill>/SKILL.md. The filesystem skill provider
# discovers <root>/<name>/SKILL.md one level deep, so each skill directory is
# copied as-is; pick the version that matches your installed dsh.
#
# Usage: bash scripts/install.sh [--version <x.y.z[-tag]>] [--dry-run]
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dsh_home="${DSH_HOME:-$HOME/.dsh}"
target_root="$dsh_home/skills"

version=""
dry_run=""
while [ $# -gt 0 ]; do
  case "$1" in
    --version) version="${2:?--version needs a value}"; shift 2 ;;
    --dry-run) dry_run="1"; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

# A version directory is any child directory that contains <skill>/SKILL.md.
versions=()
for dir in "$repo_root"/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  for sub in "$dir"*/; do
    [ -f "${sub}SKILL.md" ] && { versions+=("$name"); break; }
  done
done

if [ "${#versions[@]}" -eq 0 ]; then
  echo "no <version>/<skill>/SKILL.md bundles found under $repo_root" >&2
  exit 1
fi

if [ -z "$version" ]; then
  # Prefer the version this machine actually runs; fall back to the highest one.
  detected="$(dsh --version 2>/dev/null | tr -d '[:space:]' | sed 's/^v//')"
  if [ -n "$detected" ] && [ -d "$repo_root/$detected" ]; then
    version="$detected"
    echo "using the installed runtime version: $version"
  else
    version="$(printf '%s\n' "${versions[@]}" | sort -V | tail -1)"
    echo "dsh version not detected (or not in this repo); using the highest directory: $version"
  fi
fi
selected="$repo_root/$version"
if [ ! -d "$selected" ]; then
  echo "unknown version: $version" >&2
  echo "available: $(printf '%s ' "${versions[@]}")" >&2
  exit 1
fi

if [ -f "$selected/STATUS.md" ]; then
  echo "note: $version is a static analysis (not verified on a running runtime); see $version/STATUS.md" >&2
fi

case "$target_root" in
  */skills) ;;
  *) echo "refusing to write outside a skills root: $target_root" >&2; exit 1 ;;
esac

found=0
for dir in "$selected"/*/; do
  [ -f "${dir}SKILL.md" ] || continue
  name="$(basename "$dir")"
  case "$name" in
    *[!a-z0-9-]*|'') echo "skip unexpected skill directory name: $name" >&2; continue ;;
  esac
  found=$((found + 1))
  if [ -n "$dry_run" ]; then
    echo "  [$version] $name -> $target_root/$name"
    continue
  fi
  rm -rf "${target_root:?}/${name:?}"
  mkdir -p "$target_root/$name"
  cp -R "$dir." "$target_root/$name/"
  echo "installed [$version] $name -> $target_root/$name"
done

if [ "$found" -eq 0 ]; then
  echo "no skills found in $selected" >&2
  exit 1
fi
[ -n "$dry_run" ] || echo "$found skill(s) from $version installed."
