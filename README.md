# Kura Convex

Image board. Posts, tags, accounts, and preferences live in Convex. Picture files live in object storage. A Go process writes the board thumbnails. Remake of [Kura v4](https://github.com/astra-chanUwU/kura-v4).

Locally, the dev server listens on port 5175.

## What talks to what

A browser never asks the Go process to resize a picture. Convex does that, then the browser reads the finished file from object storage.

```
Browser
  │  queries and login
  ├──────────────────────────▶ Convex
  │  JPEG, PNG, WebP, GIF, thumbnail
  └──────────────────────────▶ Object storage (bucket kura-images)

Convex
  │  POST /v1/thumbnails/batch
  └──────────────────────────▶ Go thumbnail process
                                    │  read original, write .thumb.webp
                                    └──────────────────▶ Object storage
```

On this computer those four are separate processes. Convex and its dashboard come from Docker. Object storage is `pnpm s3`. The encoder is `pnpm thumbs`. The site is `pnpm dev`.

| Process | Address on this computer |
| --- | --- |
| Site | http://127.0.0.1:5175 |
| Convex | http://127.0.0.1:3210 |
| Convex HTTP (login and other HTTP actions) | http://127.0.0.1:3211 |
| Dashboard | http://127.0.0.1:6791 |
| Object storage | http://127.0.0.1:9000 |
| Go thumbnails | http://127.0.0.1:5006 |

## Run it on this computer

Node 24 or newer, pnpm 12, and Docker.

```sh
pnpm install
node scripts/self-hosted-env.mjs
node scripts/ensure-env.mjs
```

`self-hosted-env` starts the Convex containers and writes `.env.local`, including an admin key. That key is the password the Convex CLI uses for this local backend. `ensure-env` adds the auth secret and the thumbnail secret, then stores them in that same local backend. Do not commit `.env.local`, `.env.production`, or `.env.convex`.

The dashboard at http://127.0.0.1:6791 asks for the admin key. Paste `CONVEX_SELF_HOSTED_ADMIN_KEY` from `.env.local`.

Start storage, the encoder, and the site in that order, each in its own terminal:

```sh
pnpm s3
pnpm thumbs
pnpm dev
```

`pnpm s3` stores files under `D:\kura-minio\data`. `pnpm dev` runs `convex dev` and Vite. Leave it running while you edit `convex/`. Each save uploads those functions to the local backend. The site is http://127.0.0.1:5175. Opening that address as `127.0.0.1` sends the browser to `localhost`, because passkeys require the host to be `localhost`.

With those three still running:

```sh
pnpm seed
pnpm accounts
```

`pnpm seed` imports 1,200 general Safebooru posts. `pnpm accounts` creates twelve users at `@kura.test`. The shared password is `KURA_SEED_PASSWORD` in `.env.local`. The first run writes `kura-local-board`. `hana@kura.test` is the owner. The others are `ren`, `sable`, `mio`, `yuna`, `akira`, `noel`, `camille`, `jules`, `priya`, `leo`, and `eden`.

`pnpm dev`, `pnpm deploy`, `pnpm seed`, `pnpm accounts`, `pnpm migrate`, and `ensure-env` read `.env.local` and stop unless the Convex URL is `127.0.0.1`, `localhost`, or `::1`. A save in `pnpm dev` cannot upload functions to a server by accident. `pnpm seed -- --dry-run` only prints the import plan.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | `convex dev` and Vite on port 5175 |
| `pnpm s3` | Object storage on port 9000. Files go in `D:\kura-minio\data` |
| `pnpm thumbs` | Build and start the thumbnail service on port 5006 |
| `pnpm seed` | Import 1,200 general Safebooru posts. See below |
| `pnpm seed:nsfw` | Import questionable and explicit posts |
| `pnpm accounts` | Create the local accounts and their saved posts |
| `pnpm migrate` | Fill search text on old posts and request missing thumbnails |
| `pnpm deploy` | Upload `convex/` once to the local backend |
| `pnpm deploy:prod` | Upload `convex/` to the server named in `.env.production`, and build the site into `dist/` |
| `pnpm convex:prod -- …` | Run a Convex CLI command against the server named in `.env.production` |
| `pnpm check` | Lint, typecheck, and production build. The backend can be stopped |
| `pnpm lint` | oxlint |
| `pnpm typecheck` | TypeScript |
| `pnpm build` | Write the site into `dist/` |
| `pnpm preview` | Serve `dist/` on port 5175 |
| `docker compose stop` | Stop Convex and the dashboard. The database volume stays |
| `docker compose up -d` | Start Convex and the dashboard again |

`node scripts/self-hosted-env.mjs` and `node scripts/ensure-env.mjs` are the first-time local setup above. Run `self-hosted-env` again with `--force` to write a new local admin key. `ensure-env` always stores the local object-storage address in the local backend.

## Run Convex on your own server

Two machines. This computer has the git checkout and builds the site. The server runs Docker. The site itself is the `dist/` folder, copied to the server afterward. Convex does not serve that folder.

```
This computer                              The server
┌──────────────────────────┐            ┌─────────────────────────────────────┐
│ git checkout             │            │ Docker                              │
│   convex/                │─ upload ──▶│   Convex API        :3210           │
│   .env.production        │            │   Convex HTTP       :3211           │
│   dist/   (the website)  │─ copy ───▶ │   Go thumbnails     private :8080   │
└──────────────────────────┘            │   MinIO             :9000           │
                                        │   Dashboard         :6791           │
                                        └─────────────────────────────────────┘

Someone opening the site
  kura.example.com        files from dist/
  api.example.com         Convex API
  auth.example.com        Convex HTTP, including login
  images.example.com      MinIO, path-style
  dashboard.example.com   Convex dashboard
```

Inside Docker, Convex calls the encoder at `http://thumbnails:8080` and MinIO at `http://minio:9000`. Those names exist only on the Docker network. Port 5006 and the MinIO console on port 9001 stay closed on the public firewall.

`docker-compose.yml` starts MinIO with username `kura` and password `kura-secret-key`. The thumbnail service in that same file has the same pair. Change both in the file before port 9000 is reachable from the internet, and use the new pair in the settings below.

### Names and HTTPS

Put HTTPS in front of the five public ports. Caddy or nginx on the server is enough. Each name forwards to a port on the server itself.

| Name | Port on the server |
| --- | --- |
| `api.example.com` | 3210 |
| `auth.example.com` | 3211 |
| `dashboard.example.com` | 6791 |
| `images.example.com` | 9000 |
| `kura.example.com` | the `dist/` files, not a Docker port |

### Start Docker

On the server, clone this repo. Next to `docker-compose.yml`, create `.env`. Compose reads it when the containers start. It is a different file from `.env.local` and from `.env.production`.

| Variable | Value |
| --- | --- |
| `CONVEX_CLOUD_ORIGIN` | `https://api.example.com` |
| `CONVEX_SITE_ORIGIN` | `https://auth.example.com` |
| `NEXT_PUBLIC_DEPLOYMENT_URL` | `https://api.example.com` |
| `KURA_THUMB_SECRET` | a long random string |
| `REDACT_LOGS_TO_CLIENT` | `true` |

`CONVEX_CLOUD_ORIGIN` is the API address browsers use. `CONVEX_SITE_ORIGIN` is the login address. The dashboard loads the API from `NEXT_PUBLIC_DEPLOYMENT_URL`. `KURA_THUMB_SECRET` is the password Convex and the Go process share.

```sh
docker compose --profile thumbs --profile s3 up -d
docker compose exec backend ./generate_admin_key.sh
```

The second command prints an admin key. That key lets a Convex CLI upload functions to this server. Open https://dashboard.example.com and paste it there.

### Write `.env.production` in the git checkout

Stay in the checkout on this computer. `.env.local` keeps describing the Docker backend on this computer. `.env.production` describes the server. Copy `.env.production.example` to `.env.production` and fill it in.

| Variable | Value |
| --- | --- |
| `CONVEX_SELF_HOSTED_URL` | `https://api.example.com` |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | the admin key printed on the server |
| `VITE_CONVEX_URL` | `https://api.example.com` |
| `VITE_CONVEX_SITE_URL` | `https://auth.example.com` |
| `VITE_SITE_URL` | `https://kura.example.com` |
| `VITE_S3_PUBLIC_URL` | `https://images.example.com/kura-images` |

Leave `CONVEX_DEPLOYMENT` and `CONVEX_DEPLOY_KEY` out of this file. Those names belong to Convex's hosted service. The CLI rejects them next to `CONVEX_SELF_HOSTED_URL`.

`pnpm convex:prod` reads `.env.production` and runs the Convex CLI against that server. The commands below store settings inside the server's Convex, which the functions read when they run.

```sh
pnpm convex:prod -- env set SITE_URL https://kura.example.com
pnpm convex:prod -- env set BETTER_AUTH_SECRET <long random string>
pnpm convex:prod -- env set KURA_S3_ENDPOINT http://minio:9000
pnpm convex:prod -- env set KURA_S3_PUBLIC_ENDPOINT https://images.example.com
pnpm convex:prod -- env set KURA_S3_BUCKET kura-images
pnpm convex:prod -- env set KURA_S3_ACCESS_KEY_ID <MinIO user>
pnpm convex:prod -- env set KURA_S3_SECRET_ACCESS_KEY <MinIO password>
pnpm convex:prod -- env set KURA_THUMB_URL http://thumbnails:8080
pnpm convex:prod -- env set KURA_THUMB_SECRET <the KURA_THUMB_SECRET from the server .env>
```

| Setting | Who uses it |
| --- | --- |
| `SITE_URL` | Login. The address of the website |
| `BETTER_AUTH_SECRET` | Login. Signs session cookies |
| `KURA_S3_ENDPOINT` | Convex, from inside Docker. `http://minio:9000` |
| `KURA_S3_PUBLIC_ENDPOINT` | The browser, when it uploads. `https://images.example.com` |
| `KURA_S3_BUCKET` | `kura-images` |
| `KURA_S3_ACCESS_KEY_ID`, `KURA_S3_SECRET_ACCESS_KEY` | The MinIO user and password from `docker-compose.yml` |
| `KURA_THUMB_URL` | Convex, from inside Docker. `http://thumbnails:8080` |
| `KURA_THUMB_SECRET` | Same string as the server `.env` |

The Go container reads the bucket with the user and password written on the `thumbnails` service in `docker-compose.yml`. Those have to match MinIO.

### Upload the functions and publish the site

On this computer:

```sh
pnpm deploy:prod
```

That reads `.env.production`, typechecks `convex/`, uploads those functions to `https://api.example.com`, and writes the website into `dist/`. The built site already contains `VITE_CONVEX_URL` and the other `VITE_` values from `.env.production`.

Copy `dist/` to the server and serve it at `https://kura.example.com`. `pnpm deploy:prod` does not copy that folder. `pnpm preview` only serves it at http://127.0.0.1:5175.

## Run the backend on Convex Cloud

Convex's [Vercel guide](https://docs.convex.dev/production/hosting/vercel) and [custom hosting guide](https://docs.convex.dev/production/hosting/custom) are the deploy. A project has a development deployment and a production deployment. `npx convex dev` writes the development deployment's name into `.env.local` as `CONVEX_DEPLOYMENT`. `npx convex deploy` uploads `convex/` to that project's production deployment. The frontend is a separate host. Convex does not serve it.

This checkout's `.env.local` is the self-hosted Docker backend, so it has `CONVEX_SELF_HOSTED_URL` instead of `CONVEX_DEPLOYMENT`. The CLI rejects those together. `pnpm deploy:prod` is the self-hosted server above. The Cloud commands below use `.env.convex`, which holds only `CONVEX_DEPLOY_KEY`.

```
Browser
  │
  ├── https://<name>.convex.cloud     production deployment (queries)
  ├── https://<name>.convex.site      same deployment, HTTP actions (login)
  ├── https://kura.example.com        dist/, your static host
  └── https://<bucket-host>/kura-images
           ▲
           │  signed PUT from the browser, GET of the picture
           │
Production deployment
  ensureThumb  ── HTTPS ──▶  https://kura-thumbnails.fly.dev
                                  │  path-style GET and PUT
                                  └──▶  the same bucket
```

`ensureThumb` in `convex/storage.ts` calls the process built from `go/thumbnails`. `pnpm thumbs` runs that process in Docker on this computer, for local development. The Convex Cloud path below runs the same Dockerfile on Fly. This computer does not stay on.

### Production deploy key

On the [Convex dashboard](https://dashboard.convex.dev), open the project's production deployment. Deployment Settings, General tab, **Generate Production Deploy Key**. Enable the `deployment:deploy` permission, then copy the key.

Copy `.env.convex.example` to `.env.convex`:

```sh
CONVEX_DEPLOY_KEY='prod:<deployment-name>|<key>'
```

That file is the production deployment for every command below. It does not contain `CONVEX_SELF_HOSTED_URL` or `CONVEX_SELF_HOSTED_ADMIN_KEY`.

### Bucket

Convex's own file storage is not what this app uses. Their S3-compatible setup is the [R2 component](https://github.com/get-convex/r2): create a bucket, add a CORS policy that allows `GET` and `PUT`, create an API token with object read and write, then store the endpoint, bucket, access key, and secret on the deployment with `npx convex env set`.

`convex/storage.ts` reads a different set of names and signs with the AWS SDK, path-style. Set those on the production deployment. `npx convex env set` with no flag writes the dev deployment. `--prod` writes the production deployment of whatever project `CONVEX_DEPLOYMENT` names. This checkout has no `CONVEX_DEPLOYMENT`, so the flag that reaches the key in `.env.convex` is `--env-file .env.convex`.

```sh
pnpm exec convex env set --env-file .env.convex KURA_S3_ENDPOINT 'https://s3.<region>.amazonaws.com'
pnpm exec convex env set --env-file .env.convex KURA_S3_PUBLIC_ENDPOINT 'https://s3.<region>.amazonaws.com'
pnpm exec convex env set --env-file .env.convex KURA_S3_BUCKET kura-images
pnpm exec convex env set --env-file .env.convex KURA_S3_ACCESS_KEY_ID '<access key id>'
pnpm exec convex env set --env-file .env.convex KURA_S3_SECRET_ACCESS_KEY '<secret access key>'
```

| Variable | R2 component name | What `convex/storage.ts` does with it |
| --- | --- | --- |
| `KURA_S3_ENDPOINT` | `R2_ENDPOINT` | HEAD and DELETE from the action |
| `KURA_S3_PUBLIC_ENDPOINT` | same endpoint, public | Host baked into the browser's signed PUT |
| `KURA_S3_BUCKET` | `R2_BUCKET` | Bucket name |
| `KURA_S3_ACCESS_KEY_ID` | `R2_ACCESS_KEY_ID` | SigV4 access key |
| `KURA_S3_SECRET_ACCESS_KEY` | `R2_SECRET_ACCESS_KEY` | SigV4 secret |

For R2 the endpoint is `https://<account-id>.r2.cloudflarestorage.com`. For AWS it is `https://s3.<region>.amazonaws.com`. Both clients in this repo use path-style (`forcePathStyle` in the action, `BucketLookupPath` in `go/thumbnails`), so the object URL is `https://<endpoint>/<bucket>/<key>`.

CORS on the bucket has to allow the website origin, `GET` and `PUT`, and header `Content-Type`. The R2 readme's policy is the shape. Put the real site origin in `AllowedOrigins`.

`docker-compose.yml` still points the local `thumbnails` service at `http://host.docker.internal:9000` with user `kura`. That block is what `pnpm thumbs` uses. The Fly app gets the real bucket through `fly secrets`, not through that file.

### Thumbnail service

`ensureThumb` POSTs to `${KURA_THUMB_URL}/v1/thumbnails/batch` with `Authorization: Bearer ${KURA_THUMB_SECRET}`. The handler is `POST /v1/thumbnails/batch` in `go/thumbnails`. The image is `go/thumbnails/Dockerfile`. It listens on 8080 and shells out to libvips and ffmpeg. Convex Cloud has no place to run that binary.

[Fly](https://fly.io/docs/languages-and-frameworks/dockerfile/) builds that Dockerfile and serves it at `https://<app>.fly.dev`. `go/thumbnails/fly.toml` sets the HTTP service to port 8080, forces HTTPS, and keeps one machine running (`min_machines_running = 1`, `auto_stop_machines = "off"`), so a thumbnail request is not waiting for a cold start. Install `flyctl`, then from `go/thumbnails`:

```sh
fly launch --no-deploy --copy-config
fly secrets set KURA_THUMB_SECRET="<long random string>" KURA_S3_ENDPOINT="https://s3.<region>.amazonaws.com" KURA_S3_BUCKET="kura-images" KURA_S3_ACCESS_KEY_ID="<access key id>" KURA_S3_SECRET_ACCESS_KEY="<secret access key>"
fly deploy
```

`fly launch` prints the app URL. `fly secrets` stores the bucket credentials and the bearer secret on Fly, not in git. `fly deploy` builds the Dockerfile on Fly's builder and starts the machine. `GET /health` on that URL is unauthenticated. `POST /v1/thumbnails/batch` still requires the bearer secret.

```sh
pnpm exec convex env set --env-file .env.convex KURA_THUMB_URL 'https://<app>.fly.dev'
pnpm exec convex env set --env-file .env.convex KURA_THUMB_SECRET '<the same string passed to fly secrets>'
```

`http://thumbnails:8080` remains the address inside the self-hosted Docker network only.

### Login and the website

Functions already have `CONVEX_CLOUD_URL` and `CONVEX_SITE_URL`. `CONVEX_SITE_URL` looks like `https://<name>.convex.site`. Better Auth in `convex/auth.ts` also reads `SITE_URL`, which is the website origin, and `BETTER_AUTH_SECRET`.

```sh
pnpm exec convex env set --env-file .env.convex SITE_URL 'https://kura.example.com'
pnpm exec convex env set --env-file .env.convex BETTER_AUTH_SECRET '<long random string>'
```

### Upload functions and build the site

The [custom hosting guide](https://docs.convex.dev/production/hosting/custom) builds with the deployment URL injected, then you upload the built files yourself:

```sh
npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name VITE_CONVEX_URL
```

That sets `VITE_CONVEX_URL` for the build, runs the build, then pushes `convex/`. This repo's build is `pnpm build`, and the command has to select `.env.convex` so it does not use the self-hosted `.env.local`.

The deploy command sets one URL. This client also needs `VITE_CONVEX_SITE_URL` (`https://<name>.convex.site`, the same value as `CONVEX_SITE_URL`), `VITE_SITE_URL`, and `VITE_S3_PUBLIC_URL` (`https://s3.<region>.amazonaws.com/kura-images`, or the R2 equivalent). `pnpm build` reads `.env.production` when that file exists, and that file is the self-hosted server. Export these three first so they win.

PowerShell:

```powershell
$env:VITE_CONVEX_SITE_URL = "https://<name>.convex.site"
$env:VITE_SITE_URL = "https://kura.example.com"
$env:VITE_S3_PUBLIC_URL = "https://s3.<region>.amazonaws.com/kura-images"
pnpm exec convex deploy --env-file .env.convex --cmd "pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL
```

POSIX shell:

```sh
export VITE_CONVEX_SITE_URL='https://<name>.convex.site'
export VITE_SITE_URL='https://kura.example.com'
export VITE_S3_PUBLIC_URL='https://s3.<region>.amazonaws.com/kura-images'
pnpm exec convex deploy --env-file .env.convex --cmd "pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL
```

Publish `dist/` at `https://kura.example.com`. On Vercel, the same build is the project's Build Command, and `CONVEX_DEPLOY_KEY` is an environment variable scoped to Production, which is the setup in their Vercel guide. Their guide's command is `npx convex deploy --cmd 'npm run build'`. Use `pnpm build` and `--cmd-url-env-var-name VITE_CONVEX_URL` here.

Dashboard env changes and later CLI calls for this deployment use `--env-file .env.convex` as well. `npx convex env set --prod` is their documented flag, and it follows `CONVEX_DEPLOYMENT` in `.env.local`.

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
