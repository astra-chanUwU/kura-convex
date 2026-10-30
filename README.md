# Kura Convex

Image board on self-hosted Convex. Posts, tags, accounts, and preferences live in Convex. Picture files live in a local S3 bucket. Remake of [Kura v4](https://github.com/astra-chanUwU/kura-v4). The app uses port 5175 so it can run next to v4.

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

`self-hosted-env` starts Docker and writes `.env.local`, including the admin key. `ensure-env` adds the auth and thumbnail secrets and pushes them into Convex. Do not commit `.env.local`.

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
| `pnpm deploy` | Push Convex functions once, without Vite |
| `pnpm check` | Lint, typecheck, and production build. Backend can be stopped |
| `pnpm lint` | oxlint |
| `pnpm typecheck` | TypeScript |
| `pnpm build` | Production build |
| `pnpm preview` | Serve the production build on port 5175 |
| `docker compose stop` | Stop Convex and the dashboard. The database volume stays |
| `docker compose up -d` | Start Convex and the dashboard again |

`node scripts/self-hosted-env.mjs` and `node scripts/ensure-env.mjs` are the first-time setup commands above. Run `self-hosted-env` again with `--force` to rewrite the admin key.

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
