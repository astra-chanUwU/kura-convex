# Kura Convex

- React + Vite + TypeScript, with one self-hosted Convex backend. There is no Go server and no Convex Cloud deployment.
- Follow the self-hosting guide: `docker compose up`, admin key in `.env.local` as `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`, then `convex dev`.
- `pnpm dev` runs `convex dev` and Vite. `convex dev` reads `.env.local` and pushes `convex/` to the Docker backend.
- Ports: backend `3210`, HTTP actions `3211`, dashboard `6791`, Vite `5175`.
- Convex functions live in `convex/`. The React app lives in `src/`. Render components call Convex hooks directly. Use CSS Modules and the semantic variables in `src/index.css`.
- Do not commit `.env.local` or admin keys.
- Public reads must not imply anonymous writes once accounts exist. This scaffold has a single public status query.
- pnpm only. Do not point the CLI at a Convex Cloud project.
