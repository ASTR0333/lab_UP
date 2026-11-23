#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if ! command -v docker >/dev/null && [[ -x /Applications/Docker.app/Contents/Resources/bin/docker ]]; then
  export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
fi
exec /bin/bash ./install-linux.sh
