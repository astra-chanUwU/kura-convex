# Kura Convex

A local remake of [Kura](https://github.com/astra-chanUwU/kura-v4), starting from a Convex backend you run on this machine. Nothing here talks to Convex Cloud.

Two backends share the same `convex/` functions and stay on different ports, so both can run at once:

| | Local dev | Self-hosted |
| --- | --- | --- |
| Command | `pnpm dev` | `pnpm dev:self-hosted` |
| Backend | Convex CLI, anonymous | Docker Compose |
| State | `.convex/` (gone with the dev process) | Docker volume `kura-convex_data` |
| Backend URL | http://127.0.0.1:3210 | http://127.0.0.1:3220 |
| HTTP actions | http://127.0.0.1:3211 | http://127.0.0.1:3221 |
| App | http://127.0.0.1:5175 | http://127.0.0.1:5176 |
| Dashboard | `pnpm convex:dashboard` while `pnpm dev` is running | http://127.0.0.1:6791 |

The app is a status page that calls `site.status`. The image board is not ported yet.

## Setup

Install Node 24 or newer, pnpm 12.15.0, and Docker.

```sh
pnpm install
```

### Local dev

```sh
pnpm dev
```

The first run downloads the open-source Convex backend and writes `.env.local`. That file is gitignored. Leave the command running; the local backend stops when it exits.

### Self-hosted

```sh
pnpm dev:self-hosted
```

That starts the backend and dashboard containers, generates `.env.selfhosted.local` (gitignored) the first time, pushes the Convex functions, and starts Vite. The admin key in that file signs the CLI in to your backend. Paste it into the dashboard at http://127.0.0.1:6791. Do not commit it.

```sh
pnpm self-hosted:up      # containers only
pnpm self-hosted:down    # stop containers, keep the volume
pnpm self-hosted:deploy  # push functions once, without Vite
pnpm self-hosted:env     # rewrite the admin key file
```

`docker/.env.example` lists the port overrides. Copy it to `docker/.env` if you need to change them. A copied `docker/.env` is gitignored so an `INSTANCE_SECRET` can live there later.

To build the frontend already pointed at the self-hosted backend:

```sh
pnpm build:self-hosted
```

## Check

```sh
pnpm check
```

That runs oxlint, TypeScript, and the Vite build. It does not need either backend running.

Ports sit next to Kura V4 (`5174`, `8094`, `56432`) without taking them.
