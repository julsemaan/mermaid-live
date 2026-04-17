import { test } from "node:test";
import assert from "node:assert/strict";
import type { QueueEvent } from "../../src/domain/QueueEvent.js";
import { RenderQueueService } from "../../src/application/services/RenderQueueService.js";

const at = (sequence: number): QueueEvent => ({
  type: "changed",
  diagramId: "a",
  sourcePath: "/tmp/a.mmd",
  sequence,
  timestamp: new Date().toISOString()
});

test("RenderQueueService deduplicates in-flight diagram updates", async () => {
  const calls: string[] = [];
  let releaseFirst: (() => void) | undefined;
  let firstCall = true;

  const queue = new RenderQueueService({
    concurrency: 1,
    handleEvent: async (event) => {
      calls.push(`${event.diagramId}:${event.sequence}`);
      if (firstCall) {
        firstCall = false;
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
    }
  });

  queue.enqueue(at(1));
  queue.enqueue(at(2));
  queue.enqueue(at(3));

  queue.enqueue({
    type: "created",
    diagramId: "b",
    sourcePath: "/tmp/b.mmd",
    sequence: 4,
    timestamp: new Date().toISOString()
  });

  assert.deepEqual(calls, ["a:1"]);

  if (!releaseFirst) {
    throw new Error("Expected first task to be pending");
  }
  releaseFirst();

  await queue.waitForIdle();

  assert.deepEqual(calls, ["a:1", "a:3", "b:4"]);
});
