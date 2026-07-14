#!/usr/bin/env bash
# Deploy the Hopscotch backend: pull latest image from ECR and (re)start it.
#   Usage: ./deploy-backend.sh
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"

preflight
ecr_login
ensure_network

# Health check via Node (the image has no curl/wget): hit the /health route.
BACKEND_HEALTH="node -e \"require('http').get('http://127.0.0.1:'+(process.env.PORT||5000)+'/health',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))\""

run_service \
  "$BACKEND_CONTAINER" \
  "$(backend_image)" \
  "${BACKEND_PORT}:5000" \
  "$BACKEND_ENV_FILE" \
  "$BACKEND_CPUS" "$BACKEND_MEMORY" "$BACKEND_MEMORY_RESERVATION" \
  --health-cmd "$BACKEND_HEALTH" \
  --health-interval 30s --health-timeout 5s --health-retries 3 --health-start-period 20s

log "Pruning dangling images"
docker image prune -f >/dev/null || true
status
ok "Backend deployed: $(backend_image)"
