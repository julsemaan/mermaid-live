import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ManifestService } from "../../src/application/services/ManifestService.js";
import type { DiagramSource } from "../../src/domain/Diagram.js";

const createSource = (id: string): DiagramSource => ({
  id,
  absolutePath: `/work/${id}.mmd`,
  relativePath: `${id}.mmd`,
  extension: "mmd",
  metadata: {
    sourceMtimeMs: 1_700_000_000_000,
    sourceSizeBytes: 123
  }
});

test("ManifestService updates entry state across render/failure/delete", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "manifest-service-"));
  const service = new ManifestService(outputRoot);

  const source = createSource("diagram-1");
  const svgPath = join(outputRoot, "diagram-1.svg");
  await writeFile(svgPath, "<svg/>", "utf8");

  const ready = await service.upsertRendered(source, svgPath);
  assert.equal(ready.status, "ready");
  assert.equal(ready.lastError, undefined);

  const failed = await service.markFailed(source, svgPath, "render broke");
  assert.equal(failed.status, "failed");
  assert.equal(failed.lastError, "render broke");

  const recovered = await service.upsertRendered(source, svgPath);
  assert.equal(recovered.status, "ready");
  assert.equal(recovered.lastError, undefined);

  const removed = await service.removeDiagram(source.id);
  assert.equal(removed?.id, source.id);
  assert.equal(service.getEntry(source.id), undefined);

  const documentRaw = await readFile(service.getManifestPath(), "utf8");
  const document = JSON.parse(documentRaw) as { diagrams: Array<{ id: string }> };
  assert.deepEqual(document.diagrams, []);
});
