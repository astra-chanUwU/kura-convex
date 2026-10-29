import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const S3rver = require("s3rver");
const AWSAccount = require("s3rver/lib/models/account");

const account = new AWSAccount("kura", "Kura");
account.createKeyPair("kura", "kura-secret-key");

const directory = process.env.KURA_S3_DIR || "D:\\kura-minio\\data";
mkdirSync(directory, { recursive: true });

const server = new S3rver({
  address: "0.0.0.0",
  port: 9000,
  directory,
  silent: true,
  allowMismatchedSignatures: true,
  vhostBuckets: false,
});

server.middleware.unshift(async (ctx, next) => {
  ctx.set("Access-Control-Allow-Origin", "*");
  ctx.set("Access-Control-Allow-Methods", "GET, PUT, HEAD, POST, DELETE, OPTIONS");
  ctx.set("Access-Control-Allow-Headers", "*");
  ctx.set("Access-Control-Expose-Headers", "ETag, Content-Length, Content-Type");
  if (ctx.method === "OPTIONS") {
    ctx.status = 204;
    return;
  }
  await next();
});

const address = await server.run();
console.log(`S3 listening on http://127.0.0.1:${address.port} (${directory})`);
