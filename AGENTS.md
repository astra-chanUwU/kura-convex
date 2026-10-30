# Kura Convex

- React + Vite + TypeScript, with one self-hosted Convex backend. There is no Go server and no Convex Cloud deployment.
- Follow the self-hosting guide: `docker compose up`, admin key in `.env.local` as `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`, then `convex dev`.
- `pnpm dev` runs `convex dev` and Vite. `convex dev` reads `.env.local` and pushes `convex/` to the Docker backend.
- Ports: backend `3210`, HTTP actions `3211`, dashboard `6791`, Vite `5175`.
- Convex functions live in `convex/`. The React app lives in `src/`. Render components call Convex hooks directly. UI is Tailwind with shadcn-style components. Picture bytes live in MinIO, never in Convex. Accounts use Better Auth. Public reads stay public; uploads and preference writes require a signed-in user.
- Do not commit `.env.local`, `.env.production`, admin keys, or `BETTER_AUTH_SECRET`.
- `.env.local` is the local backend. `pnpm dev`, `pnpm deploy`, seed, accounts, migrate, and `ensure-env` refuse a non-loopback URL.
- Production is a second self-hosted backend in `.env.production`. `pnpm deploy:prod` runs `convex deploy --env-file .env.production`. `convex env --prod` is a Convex Cloud flag and does not select that backend.
- pnpm only. Do not point the CLI at a Convex Cloud project.
