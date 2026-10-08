#!/bin/sh
set -eu

cd /workspace

# Named volumes isolate Linux dependencies from the host. Reinstall after a
# manifest or Node runtime change, including when switching Git branches.
dependency_hash="$(
  { cat package.json package-lock.json; node -p 'process.version + process.platform + process.arch'; } \
    | sha256sum | cut -d ' ' -f 1
)"
installed_hash="$(cat node_modules/.staypack-dependencies 2>/dev/null || true)"

if [ "$dependency_hash" != "$installed_hash" ] || [ ! -x node_modules/.bin/next ]; then
  printf 'Installing container dependencies from package-lock.json...\n'
  npm ci --include=dev --no-audit --no-fund
  printf '%s\n' "$dependency_hash" > node_modules/.staypack-dependencies
fi

exec "$@"
