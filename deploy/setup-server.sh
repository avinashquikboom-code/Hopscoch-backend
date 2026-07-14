#!/usr/bin/env bash
# =============================================================================
# setup-server.sh — install the Hopscotch nginx site (idempotent, additive).
# Does NOT touch the existing HRM site or the default site. Assumes nginx +
# certbot are already installed (they are, from the HRM setup). If not, this
# installs them too.
# Run with sudo:  sudo ./setup-server.sh
# =============================================================================
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say() { echo -e "\033[34m==>\033[0m $*"; }

[[ "$(id -u)" -eq 0 ]] || { echo "Run with sudo." >&2; exit 1; }

# ---- nginx + certbot (install only if missing) -------------------------------
if ! command -v nginx >/dev/null 2>&1; then
  say "Installing nginx"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx
fi
if ! command -v certbot >/dev/null 2>&1; then
  say "Installing certbot (Let's Encrypt)"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx
fi

say "Installing Hopscotch nginx site (alongside any existing sites)"
install -m 644 "$DIR/nginx/hopscotch.conf" /etc/nginx/sites-available/hopscotch.conf
ln -sf /etc/nginx/sites-available/hopscotch.conf /etc/nginx/sites-enabled/hopscotch.conf

say "Testing nginx config"
nginx -t
systemctl reload nginx || systemctl restart nginx
say "nginx reloaded"

say "Server setup complete."
echo "Next:"
echo "  1. Point DNS A records to this server ($(curl -4 -s ifconfig.me 2>/dev/null || echo '69.62.80.20')):"
echo "       fciseller.com, www.fciseller.com, admin.fciseller.com, api.fciseller.com"
echo "  2. ./deploy-all.sh                  # pull images + start containers"
echo "  3. sudo certbot --nginx \\"
echo "       -d fciseller.com -d www.fciseller.com \\"
echo "       -d admin.fciseller.com -d api.fciseller.com"
