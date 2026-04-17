import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ManifestService } from "../../src/application/services/ManifestService.js";
import { RealtimeEventBus } from "../../src/application/services/RealtimeEventBus.js";
import { ApiServer } from "../../src/interfaces/http/ApiServer.js";
import type { DiagramSource } from "../../src/domain/Diagram.js";
import { allocatePort } from "../helpers/network.js";

const makeSource = (id: string, absolutePath: string, size: number): DiagramSource => ({
  id,
  absolutePath,
  relativePath: `${id}.mmd`,
  extension: "mmd",
  metadata: {
    sourceMtimeMs: Date.now(),
    sourceSizeBytes: size
  }
});

const readSseEvents = async (
  baseUrl: string,
  expected: number
): Promise<Array<{ id?: string; type?: string; data?: string }>> => {
  return await new Promise((resolve, reject) => {
    const url = new URL("/api/events", baseUrl);
    const events: Array<{ id?: string; type?: string; data?: string }> = [];
    let buffer = "";
    const req = httpRequest(url, (res) => {
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        buffer += chunk;
        while (buffer.includes("\n\n")) {
          const splitAt = buffer.indexOf("\n\n");
          const block = buffer.slice(0, splitAt);
          buffer = buffer.slice(splitAt + 2);
          if (!block || block.startsWith(":")) {
            continue;
          }

          const record: { id?: string; type?: string; data?: string } = {};
          for (const line of block.split("\n")) {
            if (line.startsWith("id: ")) {
              record.id = line.slice(4);
            } else if (line.startsWith("event: ")) {
              record.type = line.slice(7);
            } else if (line.startsWith("data: ")) {
              record.data = line.slice(6);
            }
          }

          if (record.type) {
            events.push(record);
          }

          if (events.length >= expected) {
            req.destroy();
            resolve(events);
            return;
          }
        }
      });
      res.on("error", reject);
    });

    req.on("error", reject);
    req.end();
  });
};

test("API stays consistent with manifest and SSE preserves event order", async () => {
  const root = await mkdtemp(join(tmpdir(), "phase5-api-"));
  const outputRoot = join(root, "output");
  await mkdir(outputRoot, { recursive: true });

  const svgA = join(outputRoot, "a.svg");
  const svgB = join(outputRoot, "b.svg");
  await writeFile(svgA, "<svg id='a' />\n", "utf8");
  await writeFile(svgB, "<svg id='b' />\n", "utf8");

  const manifest = new ManifestService(outputRoot);
  const sourceA = makeSource("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", join(root, "a.mmd"), 10);
  const sourceB = makeSource("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", join(root, "b.mmd"), 11);
  await manifest.upsertRendered(sourceA, svgA);
  await manifest.markFailed(sourceB, svgB, "syntax error");

  const bus = new RealtimeEventBus();
  const port = await allocatePort();
  let queueDepth = 0;
  const api = new ApiServer({
    port,
    logger: {
      fatal: () => undefined,
      error: () => undefined,
      warn: () => undefined,
      info: () => undefined,
      debug: () => undefined,
      trace: () => undefined,
      silent: () => undefined
    } as never,
    manifestService: manifest,
    realtimeEventBus: bus,
    getHealthSnapshot: () => ({
      startedAt: new Date(0).toISOString(),
      uptimeMs: 4_000,
      renderSuccessCount: 7,
      renderFailureCount: 2,
      queueDepth
    })
  });

  await api.start();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const list = await fetch(`${baseUrl}/api/diagrams`);
    assert.equal(list.status, 200);
    const listBody = (await list.json()) as { diagrams: Array<{ id: string; status: string }> };
    assert.equal(listBody.diagrams.length, 2);

    const detail = await fetch(`${baseUrl}/api/diagrams/${encodeURIComponent(sourceA.id)}`);
    assert.equal(detail.status, 200);
    const detailBody = (await detail.json()) as { diagram: { id: string } };
    assert.equal(detailBody.diagram.id, sourceA.id);

    const ssePromise = readSseEvents(baseUrl, 2);
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    bus.publish({
      type: "diagram.updated",
      payload: {
        eventId: "event-1",
        id: sourceA.id,
        version: "v2",
        updatedAt: new Date().toISOString(),
        status: "ready"
      }
    });
    bus.publish({
      type: "diagram.failed",
      payload: {
        eventId: "event-2",
        id: sourceB.id,
        version: "v3",
        updatedAt: new Date().toISOString(),
        status: "failed",
        reason: "syntax"
      }
    });

    const events = await ssePromise;
    assert.deepEqual(
      events.map((event) => ({ id: event.id, type: event.type })),
      [
        { id: "event-1", type: "diagram.updated" },
        { id: "event-2", type: "diagram.failed" }
      ]
    );

    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    const healthBody = (await health.json()) as { status: string; health: { sseClients: number } };
    assert.equal(healthBody.status, "ok");
    assert.equal(typeof healthBody.health.sseClients, "number");

    queueDepth = 5;
    const metrics = await fetch(`${baseUrl}/api/metrics`);
    assert.equal(metrics.status, 200);
    const metricsBody = await metrics.text();
    assert.match(metricsBody, /mermaid_live_renders_total 7/);
    assert.match(metricsBody, /mermaid_live_render_failures_total 2/);
    assert.match(metricsBody, /mermaid_live_queue_depth 5/);
  } finally {
    await api.close();
  }
});
