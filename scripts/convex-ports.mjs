import { spawnSync } from "node:child_process";

let cached;

export function localPortArgs(cli) {
  if (cached) return cached;
  const help = spawnSync(process.execPath, [cli, "dev", "--help"], {
    encoding: "utf8",
  });
  const text = `${help.stdout ?? ""}\n${help.stderr ?? ""}`;
  cached = text.includes("--local-cloud-port")
    ? ["--local-cloud-port", "3210", "--local-site-port", "3211"]
    : [];
  return cached;
}
