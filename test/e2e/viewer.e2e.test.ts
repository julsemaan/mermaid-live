import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { Logger } from "pino";
import { ManifestService } from "../../src/application/services/ManifestService.js";
import { RealtimeEventBus } from "../../src/application/services/RealtimeEventBus.js";
import { ApiServer } from "../../src/interfaces/http/ApiServer.js";
import { allocatePort } from "../helpers/network.js";

const quietLogger: Logger = {
  fatal: () => quietLogger,
  error: () => quietLogger,
  warn: () => quietLogger,
  info: () => quietLogger,
  debug: () => quietLogger,
  trace: () => quietLogger,
  level: "silent"
} as unknown as Logger;

test("viewer routes and interaction contracts stay stable", async () => {
  const root = await mkdtemp(join(tmpdir(), "phase5-e2e-"));
  const outputRoot = join(root, "output");
  await mkdir(outputRoot, { recursive: true });
  const svgPath = join(outputRoot, "one.svg");
  await writeFile(svgPath, "<svg/>\n", "utf8");

  const manifest = new ManifestService(outputRoot);
  await manifest.upsertRendered(
    {
      id: "one",
      absolutePath: join(root, "one.mmd"),
      relativePath: "one.mmd",
      extension: "mmd",
      metadata: { sourceMtimeMs: Date.now(), sourceSizeBytes: 42 }
    },
    svgPath
  );

  const port = await allocatePort();
  const server = new ApiServer({
    port,
    logger: quietLogger,
    manifestService: manifest,
    realtimeEventBus: new RealtimeEventBus(),
    getHealthSnapshot: () => ({
      startedAt: new Date(0).toISOString(),
      uptimeMs: 1,
      renderSuccessCount: 1,
      renderFailureCount: 0,
      queueDepth: 0
    })
  });
  await server.start();

  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const html = await (await fetch(`${baseUrl}/`)).text();
    assert.match(html, /id="diagram-nav"/);
    assert.match(html, /id="main-content"/);

    const singleRoute = await (await fetch(`${baseUrl}/diagram/one`)).text();
    assert.equal(singleRoute, html);

    const js = await (await fetch(`${baseUrl}/viewer.js`)).text();
    assert.match(js, /new IntersectionObserver\(/);
    assert.match(js, /document\.addEventListener\("keydown"/);
    assert.match(js, /"wheel"/);
    assert.match(js, /new EventSource\("\/api\/events"\)/);
    assert.match(js, /if \(getRoute\(\)\.mode === "single" && getRoute\(\)\.id === payload\.id\)/);
    assert.ok(!js.includes("setInterval(function () {\n      void refreshList"));
  } finally {
    await server.close();
  }
});
