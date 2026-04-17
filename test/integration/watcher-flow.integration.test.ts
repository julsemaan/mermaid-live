import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DiagramCatalogService } from "../../src/application/services/DiagramCatalogService.js";
import { EventIngestionService } from "../../src/application/services/EventIngestionService.js";
import { ManifestService } from "../../src/application/services/ManifestService.js";
import { RenderQueueService } from "../../src/application/services/RenderQueueService.js";
import { RenderService, type Renderer } from "../../src/application/services/RenderService.js";
import type { DiagramSource } from "../../src/domain/Diagram.js";
import { SourceWatcher } from "../../src/infrastructure/fs/SourceWatcher.js";
import { resolveOutputPathForDiagram } from "../../src/infrastructure/fs/paths.js";
import { waitFor } from "../helpers/network.js";

class FakeRenderer implements Renderer {
  public readonly renderCalls = new Map<string, number>();

  public async render(source: DiagramSource, outputPath: string) {
    this.renderCalls.set(source.id, (this.renderCalls.get(source.id) ?? 0) + 1);
    await writeFile(outputPath, `<svg data-id="${source.id}"/>`, "utf8");
    return {
      ok: true as const,
      diagramId: source.id,
      source,
      artifact: {
        diagramId: source.id,
        outputPath,
        format: "svg" as const
      },
      durationMs: 1
    };
  }
}

test("file change triggers one targeted render and manifest update", async () => {
  const root = await mkdtemp(join(tmpdir(), "phase5-watcher-"));
  const inputRoot = join(root, "input");
  const outputRoot = join(root, "output");
  await mkdir(inputRoot, { recursive: true });
  await mkdir(outputRoot, { recursive: true });

  const changedPath = join(inputRoot, "changed.mmd");
  const untouchedPath = join(inputRoot, "untouched.mmd");
  await writeFile(changedPath, "graph TD\nA-->B\n", "utf8");
  await writeFile(untouchedPath, "graph TD\nB-->C\n", "utf8");

  const catalog = new DiagramCatalogService();
  const renderer = new FakeRenderer();
  const renderService = new RenderService(renderer);
  const manifest = new ManifestService(outputRoot);

  const queue = new RenderQueueService({
    concurrency: 1,
    handleEvent: async (event) => {
      if (event.type === "deleted") {
        await manifest.removeDiagram(event.diagramId);
        return;
      }

      const source = await catalog.readSource(inputRoot, event.sourcePath);
      if (!source) {
        return;
      }
      const outputPath = await resolveOutputPathForDiagram(outputRoot, source);
      const result = await renderService.renderOne(source, outputPath);
      if (result.ok) {
        await manifest.upsertRendered(source, outputPath);
      }
    }
  });

  const ingestion = new EventIngestionService({
    debounceWindowMs: 60,
    onFlush: (events) => {
      for (const event of events) {
        queue.enqueue(event);
      }
    }
  });

  const watcher = new SourceWatcher({
    inputRootPath: inputRoot,
    onEvent: (event) => ingestion.ingest(event)
  });

  await watcher.start();
  try {
    await writeFile(changedPath, "graph TD\nA-->B\nB-->C\n", "utf8");

    const changedId = (await catalog.readSource(inputRoot, changedPath))?.id;
    const untouchedId = (await catalog.readSource(inputRoot, untouchedPath))?.id;
    assert.ok(changedId);
    assert.ok(untouchedId);

    await waitFor(() => (renderer.renderCalls.get(changedId) ?? 0) > 0, 3_000);
    await queue.waitForIdle();

    assert.equal(renderer.renderCalls.get(changedId), 1);
    assert.equal(renderer.renderCalls.get(untouchedId), undefined);

    const renderedEntry = manifest.getEntry(changedId);
    assert.ok(renderedEntry);
    assert.equal(renderedEntry.status, "ready");

    const svg = await readFile(renderedEntry.svgPath, "utf8");
    assert.match(svg, /data-id=/);
  } finally {
    await watcher.close();
  }
});
