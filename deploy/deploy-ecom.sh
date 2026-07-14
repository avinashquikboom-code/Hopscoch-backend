#!/usr/bin/env bash
# Deploy the Hopscotch storefront: pull latest image from ECR and (re)start it.
#   Usage: ./deploy-ecom.sh
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"

preflight
ecr_login
ensure_network

# Health check via Node (the image has no curl/wget): hit the root on the app port.
ECOM_HEALTH="node -e \"require('http').get('http://127.0.0.1:'+(process.env.PORT||3000),r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))\""

run_service \
  "$ECOM_CONTAINER" \
  "$(ecom_image)" \
  "${ECOM_PORT}:3000" \
  "$ECOM_ENV_FILE" \
  "$ECOM_CPUS" "$ECOM_MEMORY" "$ECOM_MEMORY_RESERVATION" \
  --health-cmd "$ECOM_HEALTH" \
  --health-interval 30s --health-timeout 5s --health-retries 3 --health-start-period 15s

log "Pruning dangling images"
docker image prune -f >/dev/null || true
status
ok "Storefront deployed: $(ecom_image)"
