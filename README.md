# Kura Convex

A local remake of [Kura](https://github.com/astra-chanUwU/kura-v4). The backend is [self-hosted Convex](https://docs.convex.dev/self-hosting), running on this machine with the official Docker Compose file. Nothing here talks to Convex Cloud.

| | |
| --- | --- |
| App | http://127.0.0.1:5175 |
| Backend | http://127.0.0.1:3210 |
| HTTP actions | http://127.0.0.1:3211 |
| Dashboard | http://127.0.0.1:6791 |

The app is an image board. Posts and preferences live in Convex. The Convex backend keeps its database and files in the Docker `data` volume. Picture files live in a local S3 bucket, `kura-images`, served by s3rver. Accounts use Better Auth. `pnpm seed` fills the board from public boorus. The default is a broad general-rated Safebooru catalog. Other presets and flags pull Danbooru, Yande.re, Konachan, and Gelbooru, including questionable and explicit posts.

## Setup

Install Node 24 or newer, pnpm 12.15.0, and Docker.

```sh
pnpm install
docker compose up -d
docker compose exec backend ./generate_admin_key.sh
```

Put the printed admin key in `.env.local`, using `.env.example` as the template:

```sh
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='<your admin key>'
VITE_CONVEX_URL='http://127.0.0.1:3210'
```

`node scripts/self-hosted-env.mjs` runs those same steps and writes `.env.local` for you. Do not commit that file.

Paste the admin key into the dashboard at http://127.0.0.1:6791.

## Develop

`pnpm dev` runs `convex dev` against the URL in `.env.local` and starts Vite. Leave it running while you edit `convex/`. Picture bytes are served by s3rver, because the public MinIO images are no longer published. Start that before the board, then seed if the board is empty.

```sh
node scripts/ensure-env.mjs
pnpm s3
pnpm thumbs
pnpm seed
```

`pnpm s3` runs s3rver, stores files under `D:\kura-minio\data`, and listens on port 9000. `pnpm thumbs` builds the Go thumbnail service and listens on port 5006. Convex calls that service after an upload. The service reads the original from `kura-images` and writes a 480px WebP beside it. The board uses the thumbnail. The post page uses the original. Until the thumbnail exists, the board shows the original.

`pnpm seed` pulls 1,200 general-rated Safebooru samples across portraits, scenery, fashion, fantasy, and the original yuri, cute, and cyberpunk tags. It asks the thumbnail service for the small copy and skips ids that are already stored. It calls the internal seed functions with the admin key. `pnpm seed -- --list` prints presets, tag sets, and boards. `--tags`, `--set`, `--board`, and `--rating` choose the search. `pnpm seed:nsfw` imports questionable and explicit posts from Danbooru, Yande.re, and Konachan. Gelbooru joins that preset when `GELBOORU_API_KEY` and `GELBOORU_USER_ID` are set in `.env.local`. Posts tagged as minors are skipped. Leave `pnpm dev` running so Convex has the seed functions before you import.

`pnpm migrate` fills search text and tag order on pictures already in Convex, then asks the thumbnail service for any picture that still has no thumbnail.

```sh
pnpm dev
pnpm exec convex deploy   # push once, without Vite
docker compose stop       # stop the backend and dashboard, keep the volume
```

When this moves to a server, run the same Compose file there and point `CONVEX_SELF_HOSTED_URL` at that host.

## Check

```sh
pnpm check
```

That runs oxlint, TypeScript, and the Vite build. It does not need the backend running.

The app port sits next to Kura V4 (`5174`) without taking it.
