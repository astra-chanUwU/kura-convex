# Kura Convex

Image board. Posts, tags, accounts, and preferences live in Convex. Picture files live in object storage. A Go process writes the board thumbnails. Remake of [Kura v4](https://github.com/astra-chanUwU/kura-v4).

The local dev server listens on port 5175.

| Service | URL |
| --- | --- |
| App | http://127.0.0.1:5175 |
| Convex | http://127.0.0.1:3210 |
| Convex HTTP | http://127.0.0.1:3211 |
| Dashboard | http://127.0.0.1:6791 |
| S3 | http://127.0.0.1:9000 |
| Thumbnails | http://127.0.0.1:5006 |

## Setup

Node 24 or newer, pnpm 12, and Docker.

```sh
pnpm install
node scripts/self-hosted-env.mjs
node scripts/ensure-env.mjs
```

`self-hosted-env` starts Docker and writes `.env.local`, including the admin key. `ensure-env` adds the auth and thumbnail secrets and pushes them into Convex. Do not commit `.env.local`, `.env.production`, or `.env.convex`.

If the dashboard at http://127.0.0.1:6791 asks for a key, paste `CONVEX_SELF_HOSTED_ADMIN_KEY` from `.env.local`.

## Run

Start these in separate terminals, in this order:

```sh
pnpm s3
pnpm thumbs
pnpm dev
```

`pnpm dev` runs `convex dev` and Vite. Leave it running while you edit `convex/`. The app is http://127.0.0.1:5175.

With `pnpm dev` still running, fill the board:

```sh
pnpm seed
pnpm accounts
```

`pnpm accounts` creates the local users. The password is `KURA_SEED_PASSWORD` in `.env.local`. The first run sets it to `kura-local-board`. `hana@kura.test` is the owner. The other accounts are `ren`, `sable`, `mio`, `yuna`, `akira`, `noel`, `camille`, `jules`, `priya`, `leo`, and `eden`, all `@kura.test`.

`pnpm dev`, `pnpm deploy`, `pnpm seed`, `pnpm accounts`, `pnpm migrate`, and `ensure-env` stop when `CONVEX_SELF_HOSTED_URL`, `VITE_CONVEX_URL`, or `VITE_CONVEX_SITE_URL` is not `127.0.0.1`, `localhost`, or `::1`. `pnpm seed -- --dry-run` still only prints the import plan. Seed and the local accounts stay on this machine.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | `convex dev` and Vite on port 5175 |
| `pnpm s3` | S3 on port 9000. Files go in `D:\kura-minio\data` |
| `pnpm thumbs` | Build and start the thumbnail service on port 5006 |
| `pnpm seed` | Import 1,200 general Safebooru posts. See below |
| `pnpm seed:nsfw` | Import questionable and explicit posts |
| `pnpm accounts` | Create the local accounts and their saved posts |
| `pnpm migrate` | Fill search text on old posts and request missing thumbnails |
| `pnpm deploy` | Push Convex functions once to the local backend |
| `pnpm deploy:prod` | Push functions to the VPS in `.env.production` and build the client |
| `pnpm convex:prod -- …` | Run a Convex CLI command against `.env.production` |
| `pnpm check` | Lint, typecheck, and production build. Backend can be stopped |
| `pnpm lint` | oxlint |
| `pnpm typecheck` | TypeScript |
| `pnpm build` | Production build |
| `pnpm preview` | Serve the production build on port 5175 |
| `docker compose stop` | Stop Convex and the dashboard. The database volume stays |
| `docker compose up -d` | Start Convex and the dashboard again |

`node scripts/self-hosted-env.mjs` and `node scripts/ensure-env.mjs` are the first-time local setup commands above. Run `self-hosted-env` again with `--force` to rewrite the local admin key. `ensure-env` writes the localhost S3 values and only talks to the local backend.

## Deploy on a VPS

This follows Convex's [own-infrastructure guide](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/hosting_on_own_infra.md), plus object storage, the Go thumbnail service, and a static frontend. Convex does not host the website. One backend has no prod mode. The VPS is a second backend, selected with `convex deploy --env-file .env.production`.

Keep `.env.local` on `127.0.0.1`. The upstream guide puts the server URL in `.env.local` and runs `npx convex dev`. These scripts refuse that, so a save does not push to the VPS.

The checked-in Compose file is the local stack. MinIO's user and password are `kura` and `kura-secret-key`, in both the `minio` service and the `thumbnails` service. Change both before the server is reachable, and use the same values in the Convex env below.

### 1. DNS and TLS

Point these names at the VPS and terminate TLS in front of them:

| Name | Forwards to | Used as |
| --- | --- | --- |
| `api.example.com` | port 3210 | Convex API |
| `auth.example.com` | port 3211 | Convex HTTP actions, including auth |
| `dashboard.example.com` | port 6791 | Convex dashboard |
| `images.example.com` | port 9000 | Object storage, path-style |
| `kura.example.com` | the static `dist/` | The website |

Leave port 5006 closed. On this Compose network the backend calls the encoder at `http://thumbnails:8080`. Port 9001 is the MinIO console. Leave that closed too.

### 2. Start the stack on the server

Clone the repo on the VPS. In a `.env` file next to `docker-compose.yml`:

```sh
CONVEX_CLOUD_ORIGIN=https://api.example.com
CONVEX_SITE_ORIGIN=https://auth.example.com
NEXT_PUBLIC_DEPLOYMENT_URL=https://api.example.com
KURA_THUMB_SECRET=<long random secret>
REDACT_LOGS_TO_CLIENT=true
```

That `.env` is for Compose. It is not `.env.local` and not `.env.production`.

```sh
docker compose --profile thumbs --profile s3 up -d
docker compose exec backend ./generate_admin_key.sh
```

Open `https://dashboard.example.com` and sign in with that admin key.

### 3. Point the laptop at the VPS

Copy `.env.production.example` to `.env.production`. Set the admin key from the server. Leave `CONVEX_DEPLOYMENT` and `CONVEX_DEPLOY_KEY` unset. The CLI rejects those names next to `CONVEX_SELF_HOSTED_URL`.

Set the function env on the VPS. `pnpm convex:prod` loads `.env.production` and runs the Convex CLI against it.

```sh
pnpm convex:prod -- env set SITE_URL https://kura.example.com
pnpm convex:prod -- env set BETTER_AUTH_SECRET <long random secret>
pnpm convex:prod -- env set KURA_S3_ENDPOINT http://minio:9000
pnpm convex:prod -- env set KURA_S3_PUBLIC_ENDPOINT https://images.example.com
pnpm convex:prod -- env set KURA_S3_BUCKET kura-images
pnpm convex:prod -- env set KURA_S3_ACCESS_KEY_ID <the MinIO user>
pnpm convex:prod -- env set KURA_S3_SECRET_ACCESS_KEY <the MinIO password>
pnpm convex:prod -- env set KURA_THUMB_URL http://thumbnails:8080
pnpm convex:prod -- env set KURA_THUMB_SECRET <the same KURA_THUMB_SECRET as the server .env>
```

`KURA_S3_ENDPOINT` is what the backend container uses. `KURA_S3_PUBLIC_ENDPOINT` is what the browser uploads to. The Go service reads the bucket with the keys in the `thumbnails` service.

### 4. Push functions and publish the site

On the laptop:

```sh
pnpm deploy:prod
```

That runs `convex deploy --env-file .env.production --cmd "pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL`. The CLI typechecks and pushes `convex/`, then builds the client. Copy `dist/` to the VPS and serve it at `https://kura.example.com`.

`pnpm preview` only serves that build on `127.0.0.1:5175`.

## Deploy on Convex

Convex Cloud is a hosted backend. `pnpm deploy:prod` does not target it. That command requires a self-hosted URL and drops `CONVEX_DEPLOY_KEY`. Cloud is selected by a production deploy key in its own file. `--env-file` reads that file alone, so `.env.local` can keep the local backend.

The Go encoder does not run inside Convex. Host it where Convex can reach it over HTTPS, with the same `KURA_THUMB_SECRET`. Object storage has to be an S3 API that Convex, the browser, and the Go process can all reach. The defaults `http://thumbnails:8080` and `http://minio:9000` only resolve inside Docker. The Go client uses path-style requests.

### 1. Create the Cloud project

```sh
pnpm exec convex login
```

Create a project in the [Convex dashboard](https://dashboard.convex.dev). In the project settings, generate a production deploy key. Copy `.env.convex.example` to `.env.convex` and paste the key:

```sh
CONVEX_DEPLOY_KEY='prod:<deployment-name>|<key>'
```

Do not put `CONVEX_SELF_HOSTED_URL` or `CONVEX_SELF_HOSTED_ADMIN_KEY` in that file.

The deployment URL is `https://<deployment-name>.convex.cloud`. HTTP actions, including auth, are `https://<deployment-name>.convex.site`. The dashboard shows both after the project exists.

### 2. Set the Cloud function env

`convex env set --env-file .env.convex` uses the deploy key, so these land on the Cloud production deployment.

```sh
pnpm exec convex env set --env-file .env.convex SITE_URL https://kura.example.com
pnpm exec convex env set --env-file .env.convex BETTER_AUTH_SECRET <long random secret>
pnpm exec convex env set --env-file .env.convex KURA_S3_ENDPOINT https://images.example.com
pnpm exec convex env set --env-file .env.convex KURA_S3_PUBLIC_ENDPOINT https://images.example.com
pnpm exec convex env set --env-file .env.convex KURA_S3_BUCKET kura-images
pnpm exec convex env set --env-file .env.convex KURA_S3_ACCESS_KEY_ID <access key>
pnpm exec convex env set --env-file .env.convex KURA_S3_SECRET_ACCESS_KEY <secret key>
pnpm exec convex env set --env-file .env.convex KURA_THUMB_URL https://thumbs.example.com
pnpm exec convex env set --env-file .env.convex KURA_THUMB_SECRET <the Go service secret>
```

`KURA_THUMB_URL` is the public address of the Go service. On the machine that runs it, set `KURA_THUMB_SECRET`, `KURA_S3_ENDPOINT`, `KURA_S3_BUCKET`, `KURA_S3_ACCESS_KEY_ID`, and `KURA_S3_SECRET_ACCESS_KEY` to that same bucket. `pnpm thumbs` is the local Docker build. A public host runs the same image with those variables and TLS in front.

### 3. Push functions and publish the site

`vite build` reads `.env.production` when that file exists. For a Cloud build, put the public URLs in the environment first so the self-hosted file does not get baked in. The CLI sets `VITE_CONVEX_URL` from the deployment.

PowerShell:

```powershell
$env:VITE_CONVEX_SITE_URL = "https://<deployment-name>.convex.site"
$env:VITE_SITE_URL = "https://kura.example.com"
$env:VITE_S3_PUBLIC_URL = "https://images.example.com/kura-images"
pnpm exec convex deploy --env-file .env.convex --cmd "pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL
```

The same command on a POSIX shell:

```sh
export VITE_CONVEX_SITE_URL='https://<deployment-name>.convex.site'
export VITE_SITE_URL='https://kura.example.com'
export VITE_S3_PUBLIC_URL='https://images.example.com/kura-images'
pnpm exec convex deploy --env-file .env.convex --cmd "pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL
```

Serve `dist/` at `https://kura.example.com`.

`--prod` on `convex env`, `convex run`, and `convex logs` selects the Cloud project's production deployment from `CONVEX_DEPLOYMENT`. This repo's `.env.local` has no `CONVEX_DEPLOYMENT`. Use `--env-file .env.convex` for those commands too.

## Seed

`pnpm dev`, `pnpm s3`, and `pnpm thumbs` need to be running first. Ids already stored are skipped. Posts tagged as minors are skipped.

```sh
pnpm seed -- --list
pnpm seed -- --preset scenery --limit 400
pnpm seed -- --set yuri,fashion --board safebooru,danbooru
pnpm seed -- --tags "yuri 1girl,witch,mecha" --limit 300
pnpm seed -- --board danbooru --rating explicit --tags nude,lingerie --dry-run
pnpm seed:nsfw
```

`--list` prints presets, tag sets, and boards. A comma is a separate search. A space inside one search means both tags. `--dry-run` only prints what it would import.

`--rating` is `safe`, `questionable`, `explicit`, or `nsfw`. The default preset is `wide` (general Safebooru). `pnpm seed:nsfw` uses Danbooru and Yande.re. Konachan is included and skipped if its API refuses the request. Gelbooru runs when `.env.local` has `GELBOORU_API_KEY` and `GELBOORU_USER_ID`. Optional Danbooru login: `DANBOORU_LOGIN` and `DANBOORU_API_KEY`.

Turn on "show sensitive" in preferences to see questionable and explicit posts.
