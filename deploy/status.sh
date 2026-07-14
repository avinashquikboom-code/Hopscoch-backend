#!/usr/bin/env bash
# Show Hopscotch container status + live resource usage + recent logs.
#   Usage: ./status.sh [backend|admin|ecom]
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"

status

case "${1:-}" in
  backend) docker logs --tail 40 "$BACKEND_CONTAINER" ;;
  admin)   docker logs --tail 40 "$ADMIN_CONTAINER" ;;
  ecom)    docker logs --tail 40 "$ECOM_CONTAINER" ;;
  "")      : ;;
  *)       die "unknown service '$1' (use: backend|admin|ecom)" ;;
esac
