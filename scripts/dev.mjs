import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { localPortArgs } from "./convex-ports.mjs";

const selfHosted = process.argv[2] === "self-hosted";
const cli = fileURLToPath(
  new URL("../node_modules/convex/bin/main.js", import.meta.url),
);
const viteBin = fileURLToPath(
  new URL("../node_modules/vite/bin/vite.js", import.meta.url),
);

const children = [];
let stopping = false;

if (selfHosted) {
  const prepare = spawn(process.execPath, ["scripts/self-hosted-env.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  children.push(prepare);
  prepare.on("exit", (code) => {
    if (stopping) return;
    if (code) process.exit(code ?? 1);
    start(
      ["dev", "--env-file", ".env.selfhosted.local"],
      ["--host", "127.0.0.1", "--port", "5176", "--mode", "selfhosted"],
    );
  });
} else {
  const once = run(process.execPath, [
    cli,
    "dev",
    "--once",
    ...localPortArgs(cli),
  ]);
  once.on("exit", (code) => {
    if (stopping) return;
    if (code) process.exit(code);
    start(["dev", ...localPortArgs(cli)], ["--host", "127.0.0.1", "--port", "5175"]);
  });
}

function start(convexArgs, viteArgs) {
  const dev = run(process.execPath, [cli, ...convexArgs]);
  const vite = run(process.execPath, [viteBin, ...viteArgs]);
  for (const child of [dev, vite]) {
    child.on("exit", (code) => {
      if (!stopping) stop(code ?? 0);
    });
  }
}

function run(command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: childEnv(),
    windowsHide: true,
  });
  children.push(child);
  return child;
}

function childEnv() {
  const env = { ...process.env };
  if (selfHosted) return env;
  env.CONVEX_AGENT_MODE = "anonymous";
  delete env.CONVEX_DEPLOY_KEY;
  return env;
}

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
  setTimeout(() => process.exit(code), 250);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
