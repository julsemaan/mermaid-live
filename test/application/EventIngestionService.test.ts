import { test } from "node:test";
import assert from "node:assert/strict";
import { EventIngestionService } from "../../src/application/services/EventIngestionService.js";

test("EventIngestionService merges duplicate diagram events", () => {
  const flushed: Array<{ diagramId: string; type: string; sequence: number }> = [];

  const service = new EventIngestionService({
    debounceWindowMs: 1_000,
    onFlush: (events) => {
      for (const event of events) {
        flushed.push({ diagramId: event.diagramId, type: event.type, sequence: event.sequence });
      }
    }
  });

  service.ingest({ type: "changed", diagramId: "a", sourcePath: "/tmp/a.mmd" });
  service.ingest({ type: "created", diagramId: "b", sourcePath: "/tmp/b.mmd" });
  service.ingest({ type: "deleted", diagramId: "a", sourcePath: "/tmp/a.mmd" });
  service.flushNow();

  assert.deepEqual(flushed, [
    { diagramId: "b", type: "created", sequence: 2 },
    { diagramId: "a", type: "deleted", sequence: 3 }
  ]);
});

test("EventIngestionService flushes automatically after debounce", async () => {
  let flushCount = 0;
  const service = new EventIngestionService({
    debounceWindowMs: 10,
    onFlush: () => {
      flushCount += 1;
    }
  });

  service.ingest({ type: "created", diagramId: "a", sourcePath: "/tmp/a.mmd" });

  await new Promise((resolve) => {
    setTimeout(resolve, 25);
  });

  assert.equal(flushCount, 1);
});
