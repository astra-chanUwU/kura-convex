# Kura Convex

- React + Vite + TypeScript, with Convex as the backend. There is no Go server and no Convex Cloud deployment.
- `pnpm dev` runs the local Convex backend (anonymous, state in `.convex/`) and Vite. `pnpm dev:self-hosted` runs against the Docker backend in `docker/docker-compose.yml`.
- Keep host ports split: local backend `3210` / site `3211` / Vite `5175`; self-hosted backend `3220` / site `3221` / dashboard `6791` / Vite `5176`.
- Convex functions live in `convex/`. The React app lives in `src/`. Render components call Convex hooks directly. Use CSS Modules and the semantic variables in `src/index.css`.
- Do not commit `.env.local`, `.env.selfhosted.local`, `docker/.env`, `.convex/`, or admin keys. `pnpm self-hosted:env` generates the self-hosted admin key.
- Public reads must not imply anonymous writes once accounts exist. This scaffold has a single public status query.
- pnpm only. Do not point the CLI at a Convex Cloud project.
