# Hi5Central self-hosted reference deployment

This directory is the first supported self-hosted deployment profile for Hi5Central. It runs the same application/API code used by the managed platform, with deployment and tenancy behaviour selected entirely at runtime.

## Reference topology

The initial profile is deliberately single-host and single-tenant:

- Workspace: `https://itsm.hi5tech.co.uk`
- Requester Portal: `https://itsm.hi5tech.co.uk/portal`
- RMM: `https://itsm.hi5tech.co.uk/rmm`
- API: same origin under `/api/*`
- PostgreSQL 17: private Docker network only
- Redis 8: private Docker network only
- Caddy: public ports 80/443 with automatic TLS

No wildcard DNS certificate is required for this first profile. A future `TENANCY_MODE=multi` profile can use tenant subdomains for MSP deployments.

## Host prerequisites

Use a clean supported Linux host with:

- Docker Engine
- Docker Compose v2
- Git
- outbound HTTPS/DNS access
- inbound TCP 80 and 443
- inbound UDP 443 is optional but enables HTTP/3

PostgreSQL and Redis are not exposed on the host network.

## DNS

Create an A record before starting Caddy:

```text
itsm.hi5tech.co.uk  ->  <Oracle VPS public IPv4>
```

If the Oracle instance has a public IPv6 address and IPv6 is correctly routed/firewalled, an AAAA record may also be added. Do not publish an AAAA record unless IPv6 is actually reachable.

## Configure

From the repository root:

```bash
cd deployment/self-hosted
cp .env.example .env
chmod 600 .env
```

Replace every `CHANGE_ME` value. Generate database and Redis passwords with hexadecimal output so they are safe inside connection URLs, for example:

```bash
openssl rand -hex 32
```

For the Hi5Tech reference instance keep:

```env
DEPLOYMENT_MODE=self_hosted
TENANCY_MODE=single
ROOT_DOMAIN=itsm.hi5tech.co.uk
PRIMARY_TENANT_SLUG=hi5tech
APP_URL=https://itsm.hi5tech.co.uk
API_URL=https://itsm.hi5tech.co.uk
PORTAL_URL=https://itsm.hi5tech.co.uk/portal
RMM_URL=https://itsm.hi5tech.co.uk/rmm
COOKIE_DOMAIN=
```

A blank `COOKIE_DOMAIN` intentionally uses host-only cookies in the single-host profile.

## Validate before starting

```bash
docker compose --env-file .env -f compose.yml config >/dev/null
```

## Start

```bash
docker compose --env-file .env -f compose.yml build
docker compose --env-file .env -f compose.yml up -d
```

The `migrate` service records each applied SQL file in `hi5_schema_migrations`. It is safe to run the stack again after future releases; only migrations that have not already been recorded are applied.

## Health checks

```bash
docker compose --env-file .env -f compose.yml ps
curl -fsS https://itsm.hi5tech.co.uk/healthz
curl -fsS https://itsm.hi5tech.co.uk/api/v1/system/deployment
curl -fsS https://itsm.hi5tech.co.uk/api/v1/system/license
```

The deployment endpoint should report `self_hosted` + `single`. A new self-hosted installation begins in evaluation mode and receives a persistent installation UUID from PostgreSQL.

## Licensing behaviour

The first reference build is offline-first:

- new self-hosted installations begin with a time-limited evaluation;
- the installation identity is persistent in PostgreSQL;
- signed licence/entitlement payload storage is reserved in the schema;
- future licence validation can periodically refresh locally cached entitlements;
- loss of contact with the licensing service must not make customer data inaccessible;
- read/export/recovery access remains available even after licence expiry;
- future offline licence files can use the same signed entitlement model.

The managed Hi5Central SaaS deployment reports `managed` and does not use installation-level self-host licensing for tenant access.

## Backups

Before this profile is considered production-ready, configure automated encrypted backups for the `postgres_data` volume and test a restore. Redis is not the source of truth; PostgreSQL is.

## Updating

For source-based reference deployments:

```bash
git pull --ff-only
docker compose --env-file deployment/self-hosted/.env -f deployment/self-hosted/compose.yml build
docker compose --env-file deployment/self-hosted/.env -f deployment/self-hosted/compose.yml up -d
```

The long-term customer distribution model will use signed/versioned Hi5Central container images so self-hosting does not require customers to maintain source forks.
