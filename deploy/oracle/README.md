# Oracle Cloud Always Free deployment with HTTPS

This path is for an always-on Linux VM instead of a sleeping platform service.

## 1. Create the VM

- Provider: Oracle Cloud Infrastructure
- Shape: `VM.Standard.A1.Flex` if available, otherwise use an Always Free eligible shape
- OS: Ubuntu 24.04 or Ubuntu 22.04
- Public IP: enabled

## 2. Point your domain to the VM

- Create an `A` record for your real domain, for example `app.yourdomain.com`
- Point it to the VM public IPv4 address
- Wait until DNS resolves to the VM before starting Caddy

## 3. Open the network

- In the OCI VCN security list, allow inbound TCP `80`
- Allow inbound TCP `443`
- Keep SSH open on TCP `22`

## 4. Fast path

If DNS already points `globalflow1.duckdns.org` to the VM, SSH in and run:

```bash
git clone https://github.com/ykidus053-create/globalflo.git /opt/globalflow
cd /opt/globalflow
chmod +x deploy/oracle/bootstrap.sh
./deploy/oracle/bootstrap.sh globalflow1.duckdns.org
```

That installs Docker, opens the firewall, writes `.env`, and starts the app.

## 5. Manual path

If you want the steps separately:

### Prepare the server

SSH into the VM, then run:

```bash
chmod +x deploy/oracle/setup-vm.sh
./deploy/oracle/setup-vm.sh
```

Log out once, then SSH back in so the `docker` group applies.

### Configure the app domain

Inside `/opt/globalflow`, create `.env` from the template and set your real domain:

```bash
cp .env.example .env
nano .env
```

Example:

```text
DOMAIN=globalflow1.duckdns.org
GLOBALFLOW_AUTOPILOT_ENABLED=1
WEB_CONCURRENCY=2
```

### Deploy the app

```bash
chmod +x deploy/oracle/deploy.sh
./deploy/oracle/deploy.sh
```

The app will be available at:

```text
https://YOUR_REAL_DOMAIN
```

TLS is automatic. Caddy requests and renews the certificate for the domain in `.env`.

## 6. Update after a new commit

```bash
cd /opt/globalflow
git pull --ff-only origin main
docker compose up -d --build
```

## 7. Useful checks

```bash
docker compose ps
docker compose logs -f globalflow
docker compose logs -f caddy
curl http://127.0.0.1:8000/health
```
