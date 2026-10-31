# Kura

Kura is an image board. The site is React. Posts, accounts, and search live in Convex. The picture files live in a bucket named `kura-images`. A Convex action makes the thumbnail.

You need pnpm, Node 24 or newer, and Docker.

## Run it on your machine

```sh
pnpm install
node scripts/self-hosted-env.mjs
node scripts/ensure-env.mjs
```

The first command installs dependencies. The second starts Convex in Docker, generates an admin key, and writes `.env.local`. The third gives that backend a Better Auth secret and the address of the picture bucket. `.env.local` stays on your machine.

Then two terminals:

```sh
pnpm s3
pnpm dev
```

`pnpm s3` is the local bucket, on port 9000. Files go to `D:\kura-minio\data`, or wherever `KURA_S3_DIR` points. `pnpm dev` pushes `convex/` to the Docker backend whenever you save, and serves the site at http://127.0.0.1:5175.

| | |
| --- | --- |
| Site | http://127.0.0.1:5175 |
| Convex | http://127.0.0.1:3210 |
| Sign-in (HTTP actions) | http://127.0.0.1:3211 |
| Dashboard | http://127.0.0.1:6791 |
| Pictures | http://127.0.0.1:9000/kura-images |

The dashboard asks for the admin key. It is the line in `.env.local` that contains `|`.

`pnpm dev` only talks to this machine. If `.env.local` points anywhere else, it stops. Ctrl+C stops the site and the watcher. The Convex data stays in Docker until you run `docker compose stop`.

`pnpm run deploy` pushes the functions once and exits. You rarely need it while `pnpm dev` is running. `pnpm deploy` without `run` is a different pnpm command.

## Seed pictures for testing

Seed only fills the board on this machine. Have `pnpm s3` running, and have `pnpm dev` pushed the functions at least once.

```sh
pnpm seed -- --dry-run --limit 40
pnpm seed -- --limit 40
```

`--dry-run` shows the plan and writes nothing. Without it, seed searches the boards, downloads originals into `kura-images`, and inserts the posts. A post already stored for that board is skipped, and a file already in the bucket is reused, so running it again only adds new pictures. Anything tagged as a minor is dropped. Files over 20 MB are skipped.

Each new post schedules a thumbnail. The action reads the original, writes a WebP with the long edge at most 480, and puts it back in the bucket. Until that finishes, the board shows the original.

The default search is the `wide` preset: general-rated Safebooru, a broad tag list, aiming for 1200 pictures. Pass `--limit` while you are trying it out. `pnpm seed -- --list` prints the presets, tag sets, and boards.

```sh
pnpm seed -- --preset scenery --limit 80
pnpm seed -- --board danbooru,safebooru --set portrait --rating safe --limit 100
pnpm seed:nsfw -- --limit 40
```

A comma separates searches. A space inside one search means both tags: `--tags "yuri 1girl,landscape"`.

Safebooru is general only. Danbooru, Yande.re, and Konachan can do the other ratings. Danbooru allows two tags per search unless `.env.local` has `DANBOORU_LOGIN` and `DANBOORU_API_KEY`. Gelbooru waits for `GELBOORU_API_KEY` and `GELBOORU_USER_ID`. If one board fails, the others still run.

### Accounts

```sh
pnpm accounts
```

This creates twelve people, fills in their profiles, and attributes imported posts to the ones who would have uploaded them. The password is `KURA_SEED_PASSWORD` in `.env.local`. The first run writes it. If you did not choose one, it is `kura-local-board`.

| Email | Role |
| --- | --- |
| hana@kura.test | owner |
| ren@kura.test | moderator |
| sable@kura.test | curator |
| mio@kura.test, yuna@kura.test, akira@kura.test, noel@kura.test, camille@kura.test | contributor |
| jules@kura.test, priya@kura.test, leo@kura.test, eden@kura.test | member |

Anyone else who signs up is a member. Contributors and above can upload. Moderators and the owner can remove someone else's post.

`pnpm migrate` is for a database you already have. It fills search text and builds any thumbnail that never got written. A fresh seed does not need it.

## Deploy on a server you run

Day to day, Docker on your machine is the backend and `pnpm dev` keeps pushing to it. A server is a second copy of that same backend. You start it once, give it public URLs, and push code with `pnpm deploy:prod` when you mean to.

On the server, use this repo's `docker-compose.yml`. Next to it, a `.env` file names the public addresses:

```sh
CONVEX_CLOUD_ORIGIN='https://api.example.com'
CONVEX_SITE_ORIGIN='https://auth.example.com'
NEXT_PUBLIC_DEPLOYMENT_URL='https://api.example.com'
```

`CONVEX_CLOUD_ORIGIN` is the Convex API. `CONVEX_SITE_ORIGIN` is where sign-in requests go. Then the proxy:

| Public URL | Port |
| --- | --- |
| `https://api.example.com` | 3210 |
| `https://auth.example.com` | 3211 |
| `https://dashboard.example.com` | 6791 |

The site itself is the Vite build, served at its own host, such as `https://kura.example.com`.

```sh
docker compose --profile s3 up -d
docker compose exec backend ./generate_admin_key.sh
```

`--profile s3` starts MinIO beside Convex, which is where the pictures go on the server. The Convex database stays in the Docker volume, so that disk has to persist. Generate the admin key after the origin variables are set. Paste it into the dashboard at the dashboard host.

On your machine, copy `.env.production.example` to `.env.production`:

```sh
CONVEX_SELF_HOSTED_URL='https://api.example.com'
CONVEX_SELF_HOSTED_ADMIN_KEY='<admin key from the server>'
VITE_CONVEX_URL='https://api.example.com'
VITE_CONVEX_SITE_URL='https://auth.example.com'
VITE_SITE_URL='https://kura.example.com'
VITE_S3_PUBLIC_URL='https://images.example.com/kura-images'
```

Leave `CONVEX_DEPLOYMENT` and `CONVEX_DEPLOY_KEY` out of this file. Then tell the server backend how to reach the site and the bucket:

```sh
pnpm convex:prod -- env set SITE_URL https://kura.example.com
pnpm convex:prod -- env set BETTER_AUTH_SECRET "<long random secret>"
pnpm convex:prod -- env set KURA_S3_ENDPOINT http://minio:9000
pnpm convex:prod -- env set KURA_S3_PUBLIC_ENDPOINT https://images.example.com
pnpm convex:prod -- env set KURA_S3_BUCKET kura-images
pnpm convex:prod -- env set KURA_S3_ACCESS_KEY_ID "<access key>"
pnpm convex:prod -- env set KURA_S3_SECRET_ACCESS_KEY "<secret key>"
```

`http://minio:9000` is the bucket as the Convex container sees it on that Compose network. `KURA_S3_PUBLIC_ENDPOINT` is the bucket as the browser sees it, without `/kura-images`. `VITE_S3_PUBLIC_URL` includes the bucket name.

```sh
pnpm deploy:prod
```

That builds `dist/` with the server's Convex URL and pushes the functions. Put `dist/` on `https://kura.example.com`. Seed and accounts stay on your machine. They will not run against this file.

## Deploy on Convex

Convex also hosts the backend for you. Log in, create a project, and develop against the dev deployment they give you:

```sh
pnpm exec convex login
pnpm exec convex dev
```

`pnpm dev` in this repo is the Docker setup above, and `.env.local` already points at it. For Convex's hosting, run `convex dev` with an env file that has `CONVEX_DEPLOYMENT` and does not have `CONVEX_SELF_HOSTED_URL`. The command writes that deployment name and URL, then keeps `convex/` in sync with your dev deployment.

When you want it live, open the production deployment in the Convex dashboard, go to Deployment Settings, and generate a deploy key with the `deployment:deploy` permission. Copy `.env.convex.example` to `.env.convex`:

```sh
CONVEX_DEPLOY_KEY='prod:<deployment-name>|<key>'
```

Set the same site and bucket variables on that deployment. The bucket URL has to be reachable from Convex, so the local `host.docker.internal` address will not work.

```sh
pnpm exec convex env set SITE_URL https://kura.example.com --env-file .env.convex
pnpm exec convex env set BETTER_AUTH_SECRET "<long random secret>" --env-file .env.convex
pnpm exec convex env set KURA_S3_ENDPOINT "<private S3 URL>" --env-file .env.convex
pnpm exec convex env set KURA_S3_PUBLIC_ENDPOINT https://images.example.com --env-file .env.convex
pnpm exec convex env set KURA_S3_BUCKET kura-images --env-file .env.convex
pnpm exec convex env set KURA_S3_ACCESS_KEY_ID "<access key>" --env-file .env.convex
pnpm exec convex env set KURA_S3_SECRET_ACCESS_KEY "<secret key>" --env-file .env.convex
```

The site build also needs the public URLs. `.env.local` still has the local ones, so set these in the shell first. On PowerShell:

```powershell
$env:VITE_CONVEX_SITE_URL = "https://<deployment>.convex.site"
$env:VITE_SITE_URL = "https://kura.example.com"
$env:VITE_S3_PUBLIC_URL = "https://images.example.com/kura-images"
pnpm exec convex deploy --env-file .env.convex --cmd "pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL
```

`VITE_CONVEX_SITE_URL` is the deployment's HTTP actions URL from the dashboard. The command fills in `VITE_CONVEX_URL` itself, writes `dist/`, and pushes the functions. Serve `dist/` at the site URL.

## Env files

| File | For |
| --- | --- |
| `.env.local` | This machine. `pnpm dev`, seed, accounts, migrate. |
| `.env.production` | Your server. `pnpm deploy:prod`. |
| `.env.convex` | A Convex deploy key. |
| `.env` | Docker ports. Defaults are 3210 and 3211. |
