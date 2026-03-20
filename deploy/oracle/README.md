# Oracle Cloud Always Free deployment

This path is for an always-on Linux VM instead of a sleeping platform service.

## 1. Create the VM

- Provider: Oracle Cloud Infrastructure
- Shape: `VM.Standard.A1.Flex` if available, otherwise use an Always Free eligible shape
- OS: Ubuntu 24.04 or Ubuntu 22.04
- Public IP: enabled

## 2. Open the network

- In the OCI VCN security list, allow inbound TCP `80`
- Allow inbound TCP `443` if you later add HTTPS
- Keep SSH open on TCP `22`

## 3. Prepare the server

SSH into the VM, then run:

```bash
chmod +x deploy/oracle/setup-vm.sh
./deploy/oracle/setup-vm.sh
```

Log out once, then SSH back in so the `docker` group applies.

## 4. Deploy the app

```bash
chmod +x deploy/oracle/deploy.sh
./deploy/oracle/deploy.sh
```

The app will be available at:

```text
http://YOUR_VM_PUBLIC_IP
```

## 5. Update after a new commit

```bash
cd /opt/globalflow
git pull --ff-only origin main
docker compose up -d --build
```

## 6. Useful checks

```bash
docker compose ps
docker compose logs -f globalflow
curl http://127.0.0.1/health
```
