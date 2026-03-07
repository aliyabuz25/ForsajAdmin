#!/usr/bin/env bash

set -euo pipefail

show_help() {
  cat <<'EOF'
Usage:
  ./scripts/push-current.sh [remote] [branch] [--force-with-lease]

Examples:
  ./scripts/push-current.sh
  ./scripts/push-current.sh origin main
  ./scripts/push-current.sh forsajadmin main --force-with-lease

Behavior:
  - Defaults to the current git branch
  - Defaults to remote "origin"
  - Shows a short summary before pushing
  - Warns if you have uncommitted changes
  - Retries HTTPS pushes with safer transport settings on HTTP 400 / disconnect errors
EOF
}

print_large_blob_warning() {
  local range="$1"
  local blob_report

  blob_report="$(
    git rev-list --objects "${range}" \
      | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
      | awk '$1 == "blob" && $3 >= 20000000 { printf "%8.2f MB  %s\n", $3 / 1048576, $4 }' \
      | sort -nr
  )"

  if [[ -n "${blob_report}" ]]; then
    echo "Large blobs detected in commits being pushed:"
    echo "${blob_report}"
    echo
  fi
}

run_push() {
  local mode="$1"
  shift

  echo "Running (${mode}): git $*"
  git "$@"
}

run_push_retryable() {
  local had_error=0

  if run_push "default" "${PUSH_ARGS[@]}"; then
    return 0
  fi

  had_error=1
  echo
  echo "Default push failed. Retrying with HTTP/1.1 and conservative transfer settings..."
  echo

  if git -c http.version=HTTP/1.1 \
         -c http.postBuffer=524288000 \
         -c core.compression=0 \
         "${PUSH_ARGS[@]}"; then
    return 0
  fi

  echo
  echo "Retry also failed."
  echo "If this keeps happening, the likely causes are:"
  echo "  1. HTTPS transport issues with GitHub on this network"
  echo "  2. Large binary files in local commits"
  echo "  3. Credential or remote repository restrictions"
  echo
  return "${had_error}"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  show_help
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

REMOTE="${1:-origin}"
BRANCH="${2:-$(git branch --show-current)}"
FORCE_FLAG="${3:-}"

if [[ -z "${BRANCH}" ]]; then
  echo "Could not detect the current branch."
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This script must run inside a git repository."
  exit 1
fi

if ! git remote get-url "${REMOTE}" >/dev/null 2>&1; then
  echo "Remote '${REMOTE}' was not found."
  echo
  echo "Available remotes:"
  git remote -v
  exit 1
fi

if [[ -n "${FORCE_FLAG}" && "${FORCE_FLAG}" != "--force-with-lease" ]]; then
  echo "Unsupported option: ${FORCE_FLAG}"
  echo "Only --force-with-lease is supported as an optional third argument."
  exit 1
fi

REMOTE_URL="$(git remote get-url "${REMOTE}")"
LAST_COMMIT="$(git log --oneline -1)"
STATUS_SUMMARY="$(git status --short)"
UPSTREAM_REF="${REMOTE}/${BRANCH}"

echo "Push summary"
echo "  repo:   ${REPO_ROOT}"
echo "  remote: ${REMOTE} (${REMOTE_URL})"
echo "  branch: ${BRANCH}"
echo "  head:   ${LAST_COMMIT}"
echo

if [[ -n "${STATUS_SUMMARY}" ]]; then
  echo "Working tree has uncommitted changes:"
  echo "${STATUS_SUMMARY}"
  echo
  echo "These changes are not part of the push unless you commit them first."
  echo
  read -r -p "Push current HEAD anyway? [y/N] " CONFIRM_DIRTY
  if [[ ! "${CONFIRM_DIRTY}" =~ ^[Yy]$ ]]; then
    echo "Push cancelled."
    exit 0
  fi
fi

PUSH_ARGS=(push -u "${REMOTE}" "${BRANCH}")
if [[ "${FORCE_FLAG}" == "--force-with-lease" ]]; then
  PUSH_ARGS=(push --force-with-lease -u "${REMOTE}" "${BRANCH}")
fi

if git show-ref --verify --quiet "refs/remotes/${UPSTREAM_REF}"; then
  print_large_blob_warning "${UPSTREAM_REF}..HEAD"
fi

run_push_retryable
