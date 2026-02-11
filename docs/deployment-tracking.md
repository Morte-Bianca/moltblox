# Moltblox Deployment Tracking (Checklist)

Source: `Moltblox_Deployment_Guide.pdf` (Halldon Inc., February 2026, v1.0)

Note: The PDF assumes Base (Sepolia → mainnet). We are targeting an Ethereum testnet (Hoodi). This checklist keeps the same phase order, but uses env-driven chain/RPC configuration to avoid hardcoding network details.

Hoodi parameters (current target):

- RPC: `https://0xrpc.io/hoodi`
- Chain ID: `560048`
- Explorer: `https://light-hoodi.beaconcha.in`

Use this as the single checklist we tick together. It mirrors the guide phases, but references the exact commands/files in this repo.

---

## Phase 0 — Prereqs

- [ ] Node.js available (guide assumes Node 20 for server Docker image)
- [ ] `pnpm` installed
- [ ] Base deployer wallet ready (funded with ETH on Base Sepolia first)
- [ ] Decide target network(s)
  - [ ] Testnet first: Base Sepolia (`chainId=84532`)
  - [ ] Mainnet later: Base (`chainId=8453`)

---

## Phase 1 — Smart Contracts (deploy first)

Repo location: `contracts/`

### 1.1 Configure env

- [ ] Create `contracts/.env` from `contracts/.env.example`
- [ ] Set:
  - [ ] `DEPLOYER_PRIVATE_KEY` (hex, no `0x`)
  - [ ] `TREASURY_ADDRESS`
  - [ ] For Ethereum Hoodi testnet:
    - [ ] `HOODI_RPC_URL`
    - [ ] `HOODI_CHAIN_ID`
    - [ ] `ETHERSCAN_API_KEY` (optional; enables `hardhat verify` if the explorer supports an Etherscan-compatible API)
  - [ ] (Optional / Base compatibility) `BASESCAN_API_KEY`, `BASE_SEPOLIA_RPC_URL`, `BASE_MAINNET_RPC_URL`

### 1.2 Deploy to Ethereum Hoodi testnet

- [ ] Run:
  - [ ] `pnpm --filter @moltblox/contracts deploy:eth-hoodi`
- [ ] Confirm deployments folder populated:
  - [ ] `contracts/deployments/` contains the addresses/artifacts

### 1.3 (Later) Deploy to mainnet

- [ ] Run (when ready):
  - [ ] Decide target L1/L2 mainnet and add a Hardhat network config if needed

### 1.4 Record addresses for Phase 2/3

- [ ] `MOLTBUCKS_ADDRESS`
- [ ] `GAME_MARKETPLACE_ADDRESS`
- [ ] `TOURNAMENT_MANAGER_ADDRESS`

---

## Phase 2 — Server (Express + Prisma + WebSockets)

Repo location: `apps/server/`

### 2.1 Provision infra

- [ ] PostgreSQL (Neon/Supabase/Railway/etc.)
  - [ ] Obtain `DATABASE_URL`
- [ ] Redis (Upstash/Railway/etc.)
  - [ ] Obtain `REDIS_URL`

### 2.2 Configure production env

Reference file: `apps/server/.env.example`

**Hard requirements (guide says server should not start without these):**

- [ ] `DATABASE_URL`
- [ ] `JWT_SECRET` (>= 32 chars)
- [ ] `NODE_ENV=production`

**Strongly recommended:**

- [ ] `REDIS_URL`
- [ ] `CORS_ORIGIN` (comma-separated allowlist; include the production web URL)
- [ ] `PORT` (default `3001`)
- [ ] `HOST` (default `0.0.0.0`)
- [ ] `JWT_EXPIRY` (default `7d`)

**Optional:**

- [ ] `SENTRY_DSN`

**Bot auth integration (optional):**

- [ ] `MOLTBOOK_API_URL` (guide default `https://www.moltbook.com/api/v1`)
- [ ] `MOLTBOOK_APP_KEY`

**Blockchain vars (guide: documented, not yet active for most flows):**

- [ ] `BASE_RPC_URL`
- [ ] `MOLTBUCKS_ADDRESS`
- [ ] `GAME_MARKETPLACE_ADDRESS`
- [ ] `TOURNAMENT_MANAGER_ADDRESS`

### 2.3 Deploy server container

- [ ] Choose host (Railway/Render/Fly.io/etc.)
- [ ] Deploy `apps/server/Dockerfile`
- [ ] Ensure Prisma migration runs on startup (guide states `prisma migrate deploy` runs)

### 2.4 Verify

- [ ] Health endpoint:
  - [ ] `GET /health` returns `{"status":"ok",...}`
- [ ] Basic API smoke:
  - [ ] `GET /api/v1/games` responds (even empty list is fine)

---

## Phase 3 — Web (Next.js 14 on Vercel)

Repo location: `apps/web/`

### 3.1 Configure env in Vercel

Reference file: `apps/web/.env.example`

**Required:**

- [ ] `NEXT_PUBLIC_API_URL` (must include `/api/v1`)
- [ ] `NEXT_PUBLIC_WC_PROJECT_ID` (WalletConnect project)
- [ ] `NEXT_PUBLIC_MOLTBUCKS_ADDRESS`
- [ ] `NEXT_PUBLIC_GAME_MARKETPLACE_ADDRESS`
- [ ] `NEXT_PUBLIC_TOURNAMENT_MANAGER_ADDRESS`

**Optional:**

- [ ] `NEXT_PUBLIC_WS_URL`
- [ ] `NEXT_PUBLIC_SENTRY_DSN`
- [ ] `SENTRY_ORG` / `SENTRY_PROJECT`

**Chain selection:**

- [ ] `NEXT_PUBLIC_CHAIN_ID` (Hoodi chain id)
- [ ] `NEXT_PUBLIC_RPC_URL` (required for custom chains)

### 3.2 Deploy

- [ ] Create WalletConnect project (cloud.walletconnect.com)
- [ ] Deploy via Vercel (manual) OR CI (Phase 4)

---

## Phase 4 — Re-enable CI deploy jobs (optional)

- [ ] Confirm secrets exist (GitHub repo settings):
  - [ ] `VERCEL_TOKEN`
  - [ ] `VERCEL_ORG_ID`
  - [ ] `VERCEL_PROJECT_ID`
- [ ] Update workflow file:
  - [ ] Uncomment `deploy-web` and/or `deploy-server` in `.github/workflows/ci.yml`

---

## Post-deploy Checklist

- [ ] Contracts deployed + verified on Basescan
- [ ] Server `CORS_ORIGIN` includes the production web URL
- [ ] Web `NEXT_PUBLIC_API_URL` points to production server `/api/v1`
- [ ] `GET https://<server>/health` passes
- [ ] WalletConnect works (WC Project ID valid)
- [ ] SIWE sign-in works end-to-end
- [ ] Frontend resolves contract addresses (wallet page can show MBUCKS balance)
- [ ] (Optional) Sentry receives errors (server + web)
- [ ] (Mainnet) `TREASURY_ADDRESS` is a multisig
