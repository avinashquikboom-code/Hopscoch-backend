# Hopscotch Deploy Toolkit

Server-side scripts to pull images from ECR and run the Hopscotch stack
(backend + admin + storefront) with resource limits behind Nginx. Mirrors the
HRM toolkit but is fully isolated from it (own network, container names, ports,
ECR repos, nginx site). Deploy this folder to the VPS at `/opt/hopscotch/`.

## Services

| Service    | Repo                   | ECR repo             | Container            | Host port (127.0.0.1) |
|------------|------------------------|----------------------|----------------------|-----------------------|
| Backend    | Hopscoch-backend       | `hopscotch-backend`  | `hopscotch-backend`  | 5005 → 5000           |
| Admin      | hopscoch_admin_pannel  | `hopscotch-admin`    | `hopscotch-admin`    | 3001 → 3000           |
| Storefront | Hopscoch-ecom          | `hopscotch-ecom`     | `hopscotch-ecom`     | 3002 → 3000           |

Ports are chosen to avoid the HRM stack (admin 3000, backend 5004).

## Layout

| File | Purpose |
|------|---------|
| `deploy.env` | Tunable config — region, repos, ports, CPU/RAM limits (copy from `deploy.env.example`) |
| `config.sh` | Shared helpers (ECR login, image URIs, resource-limited `run_service`) — sourced, not run |
| `deploy-backend.sh` | Pull + (re)start backend on :5005 |
| `deploy-admin.sh` | Pull + (re)start admin on :3001 |
| `deploy-ecom.sh` | Pull + (re)start storefront on :3002 |
| `deploy-all.sh` | All three, backend first |
| `status.sh` | Container status + live CPU/mem + recent logs |
| `setup-server.sh` | Install the Hopscotch nginx site (additive; leaves HRM alone) |
| `nginx/hopscotch.conf` | Reverse proxy: storefront/admin/api → the three containers |
| `*.env.example` | Templates for the runtime secret files (backend/admin/ecom) |

## One-time setup (per machine, once)

### 1. Create the ECR repos (from your laptop, or anywhere with AWS creds)

```bash
for r in hopscotch-backend hopscotch-admin hopscotch-ecom; do
  aws ecr create-repository --repository-name "$r" --region ap-south-1 || true
done
```

### 2. Add GitHub secrets to each of the 3 repos

Each repo's workflow needs `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
(same IAM user the HRM repos use). In each repo:
Settings → Secrets and variables → Actions → New repository secret.

### 3. On the VPS

```bash
# Copy this deploy/ folder to /opt/hopscotch (e.g. git pull the backend repo,
# or rsync). Then:
cd /opt/hopscotch
cp deploy.env.example deploy.env             # adjust limits/tag if needed

cp backend.env.example backend.env           # fill in REAL secrets
cp admin.env.example   admin.env
cp ecom.env.example    ecom.env
chmod 600 backend.env admin.env ecom.env

# Create the app's Postgres database on the VPS host if not present:
#   sudo -u postgres createdb hopscotch
# and set DATABASE_URL in backend.env to host.docker.internal:5432/hopscotch

# nginx/hopscotch.conf already targets the fciseller.com domains.
sudo ./setup-server.sh                        # installs the nginx site
./deploy-all.sh                               # pull from ECR + start all three
sudo certbot --nginx \
  -d fciseller.com -d www.fciseller.com \
  -d admin.fciseller.com -d api.fciseller.com
```

## Day-to-day

```bash
./deploy-backend.sh     # ship new backend image (after CI pushes :latest)
./deploy-admin.sh       # ship new admin image
./deploy-ecom.sh        # ship new storefront image
./status.sh             # see what's running + resource usage
./status.sh backend     # + tail backend logs
```

## Capacity — READ BEFORE DEPLOYING ALL THREE

The host is **2 vCPU / ~1.9 GB RAM** and is **already running the HRM stack**
(backend ~640m limit, admin ~512m limit). The default Hopscotch limits add:

- backend `512m`, admin `384m`, storefront `384m`  → **~1.28 GB more**

That would oversubscribe RAM. The 2 GB swapfile (added by the HRM setup) gives
headroom, but check real usage first:

```bash
free -m
docker stats --no-stream
```

Options if RAM is tight:
- Lower the `*_MEMORY` values in `deploy.env`.
- Deploy only the services you need right now (e.g. backend + storefront).
- Move Hopscotch to its own VPS (recommended for production).

## Rollback

Set `IMAGE_TAG=<git-sha>` in `deploy.env` (CI tags every image with the commit
SHA), then re-run the relevant deploy script.

## How secrets work (same model as HRM)

Images contain **no secrets**. `.env` files live only on the VPS
(`/opt/hopscotch/*.env`, `chmod 600`) and are injected at container start via
`--env-file`. CI only builds/pushes images; it never sees app secrets.
