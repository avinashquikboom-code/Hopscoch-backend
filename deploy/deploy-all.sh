#!/usr/bin/env bash
# Deploy all three services (backend first, then admin, then storefront).
#   Usage: ./deploy-all.sh
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$DIR/deploy-backend.sh"
"$DIR/deploy-admin.sh"
"$DIR/deploy-ecom.sh"
echo "All services deployed."
