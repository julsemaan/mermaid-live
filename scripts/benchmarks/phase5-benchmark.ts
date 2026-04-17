import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { DiagramCatalogService } from "../../src/application/services/DiagramCatalogService.js";
import { ManifestService } from "../../src/application/services/ManifestService.js";
import { RenderService, type Renderer } from "../../src/application/services/RenderService.js";
import { RealtimeEventBus } from "../../src/application/services/RealtimeEventBus.js";
import type { DiagramSource } from "../../src/domain/Diagram.js";
import { ApiServer } from "../../src/interfaces/http/ApiServer.js";
import { ensureDirectory } from "../../src/infrastructure/fs/paths.js";

interface TierResult {
  avgMs: number;
  maxMs: number;
}

interface ApiResult {
  avgMs: number;
  p95Ms: number;
}

interface BenchmarkReport {
  generatedAt: string;
  renderLatencyByTier: Record<string, TierResult>;
  apiLatencyByDiagramCount: Record<string, ApiResult>;
  idleNetworkQuiet: {
    sampleWindowMs: number;
    unsolicitedEventBlocks: number;
  };
}

class IoRenderer implements Renderer {
  public async render(source: DiagramSource, outputPath: string) {
    const content = await readFile(source.absolutePath, "utf8");
    await writeFile(outputPath, `<svg data-bytes="${content.length}"/>\n`, "utf8");

    return {
      ok: true as const,
      diagramId: source.id,
      source,
      artifact: {
        diagramId: source.id,
        outputPath,
        format: "svg" as const
      },
      durationMs: 0
    };
  }
}

const allocatePort = async (): Promise<number> => {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to allocate benchmark port")));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
};

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
};

const renderTierBenchmark = async (): Promise<Record<string, TierResult>> => {
  const root = await mkdtemp(join(tmpdir(), "phase5-render-bench-"));
  const inputRoot = join(root, "input");
  const outputRoot = join(root, "output");
  await mkdir(inputRoot, { recursive: true });
  await mkdir(outputRoot, { recursive: true });

  const tiers = {
    small: 1_200,
    medium: 14_000,
    large: 120_000
  };

  const catalog = new DiagramCatalogService();
  const service = new RenderService(new IoRenderer());
  const output: Record<string, TierResult> = {};

  for (const [tier, bytes] of Object.entries(tiers)) {
    const filePath = join(inputRoot, `${tier}.mmd`);
    const repeat = "A-->B\n".repeat(Math.ceil(bytes / 6));
    await writeFile(filePath, `graph TD\n${repeat}`, "utf8");
    const source = await catalog.readSource(inputRoot, filePath);
    if (!source) {
      throw new Error(`Unable to build source for ${filePath}`);
    }

    const samples: number[] = [];
    for (let index = 0; index < 10; index += 1) {
      const target = join(outputRoot, `${tier}-${index}.svg`);
      const startedAt = performance.now();
      await service.renderOne(source, target);
      samples.push(performance.now() - startedAt);
    }

    output[tier] = {
      avgMs:
        Math.round((samples.reduce((sum, value) => sum + value, 0) / samples.length) * 100) / 100,
      maxMs: Math.round(Math.max(...samples) * 100) / 100
    };
  }

  return output;
};

const apiLatencyBenchmark = async (): Promise<Record<string, ApiResult>> => {
  const root = await mkdtemp(join(tmpdir(), "phase5-api-bench-"));
  const outputRoot = join(root, "output");
  await mkdir(outputRoot, { recursive: true });

  const runFor = async (diagramCount: number): Promise<ApiResult> => {
    const manifest = new ManifestService(outputRoot);
    for (let index = 0; index < diagramCount; index += 1) {
      const id = `d-${index}`;
      const sourcePath = join(root, `${id}.mmd`);
      const svgPath = join(outputRoot, `${id}.svg`);
      await writeFile(svgPath, `<svg id="${id}"/>\n`, "utf8");
      await manifest.upsertRendered(
        {
          id,
          absolutePath: sourcePath,
          relativePath: `${id}.mmd`,
          extension: "mmd",
          metadata: { sourceMtimeMs: Date.now(), sourceSizeBytes: 64 }
        },
        svgPath
      );
    }

    const port = await allocatePort();
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
      realtimeEventBus: new RealtimeEventBus(),
      getHealthSnapshot: () => ({
        startedAt: new Date().toISOString(),
        uptimeMs: 2_000,
        renderSuccessCount: diagramCount,
        renderFailureCount: 0,
        queueDepth: 0
      })
    });

    await api.start();
    try {
      const samples: number[] = [];
      for (let index = 0; index < 20; index += 1) {
        const startedAt = performance.now();
        const response = await fetch(`http://127.0.0.1:${port}/api/diagrams`);
        if (response.status !== 200) {
          throw new Error(`Unexpected /api/diagrams status: ${response.status}`);
        }
        await response.arrayBuffer();
        samples.push(performance.now() - startedAt);
      }

      return {
        avgMs:
          Math.round((samples.reduce((sum, value) => sum + value, 0) / samples.length) * 100) / 100,
        p95Ms: Math.round(percentile(samples, 95) * 100) / 100
      };
    } finally {
      await api.close();
    }
  };

  return {
    "100": await runFor(100),
    "500": await runFor(500),
    "1000": await runFor(1000)
  };
};

const idleQuietBenchmark = async (): Promise<{
  sampleWindowMs: number;
  unsolicitedEventBlocks: number;
}> => {
  const root = await mkdtemp(join(tmpdir(), "phase5-idle-bench-"));
  const outputRoot = join(root, "output");
  await mkdir(outputRoot, { recursive: true });

  const port = await allocatePort();
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
    manifestService: new ManifestService(outputRoot),
    realtimeEventBus: new RealtimeEventBus(),
    getHealthSnapshot: () => ({
      startedAt: new Date().toISOString(),
      uptimeMs: 1_000,
      renderSuccessCount: 0,
      renderFailureCount: 0,
      queueDepth: 0
    })
  });

  await api.start();
  try {
    const sampleWindowMs = 2_500;
    const unsolicitedEventBlocks = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(`http://127.0.0.1:${port}/api/events`, (res) => {
        let blocks = 0;
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          data += chunk;
          while (data.includes("\n\n")) {
            const splitAt = data.indexOf("\n\n");
            const block = data.slice(0, splitAt);
            data = data.slice(splitAt + 2);
            if (!block.startsWith("retry:")) {
              blocks += 1;
            }
          }
        });

        setTimeout(() => {
          req.destroy();
          resolve(blocks);
        }, sampleWindowMs);
      });

      req.on("error", reject);
      req.end();
    });

    return {
      sampleWindowMs,
      unsolicitedEventBlocks
    };
  } finally {
    await api.close();
  }
};

const failOnThresholds = (report: BenchmarkReport): void => {
  const thresholds = {
    smallAvgMs: 30,
    mediumAvgMs: 35,
    largeAvgMs: 65,
    apiP95For1000Ms: 45,
    idleEvents: 0
  };

  const failures: string[] = [];
  if (report.renderLatencyByTier.small.avgMs > thresholds.smallAvgMs) {
    failures.push(
      `small tier avg ${report.renderLatencyByTier.small.avgMs}ms exceeds ${thresholds.smallAvgMs}ms`
    );
  }
  if (report.renderLatencyByTier.medium.avgMs > thresholds.mediumAvgMs) {
    failures.push(
      `medium tier avg ${report.renderLatencyByTier.medium.avgMs}ms exceeds ${thresholds.mediumAvgMs}ms`
    );
  }
  if (report.renderLatencyByTier.large.avgMs > thresholds.largeAvgMs) {
    failures.push(
      `large tier avg ${report.renderLatencyByTier.large.avgMs}ms exceeds ${thresholds.largeAvgMs}ms`
    );
  }
  if (report.apiLatencyByDiagramCount["1000"].p95Ms > thresholds.apiP95For1000Ms) {
    failures.push(
      `api p95 @1000 ${report.apiLatencyByDiagramCount["1000"].p95Ms}ms exceeds ${thresholds.apiP95For1000Ms}ms`
    );
  }
  if (report.idleNetworkQuiet.unsolicitedEventBlocks > thresholds.idleEvents) {
    failures.push(
      `idle stream produced ${report.idleNetworkQuiet.unsolicitedEventBlocks} event blocks (expected 0)`
    );
  }

  if (failures.length > 0) {
    throw new Error(`Performance regression:\n- ${failures.join("\n- ")}`);
  }
};

const toMarkdown = (report: BenchmarkReport): string => {
  return [
    "# Phase 5 Performance Baseline",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "## Render latency by file size tier",
    "",
    "| Tier | Avg ms | Max ms |",
    "| --- | ---: | ---: |",
    ...Object.entries(report.renderLatencyByTier).map(
      ([tier, value]) => `| ${tier} | ${value.avgMs} | ${value.maxMs} |`
    ),
    "",
    "## API list latency by diagram count",
    "",
    "| Diagrams | Avg ms | P95 ms |",
    "| ---: | ---: | ---: |",
    ...Object.entries(report.apiLatencyByDiagramCount).map(
      ([count, value]) => `| ${count} | ${value.avgMs} | ${value.p95Ms} |`
    ),
    "",
    "## Idle network quiet check",
    "",
    `- Sample window: ${report.idleNetworkQuiet.sampleWindowMs}ms`,
    `- Unsolicited SSE event blocks: ${report.idleNetworkQuiet.unsolicitedEventBlocks}`,
    ""
  ].join("\n");
};

const main = async (): Promise<void> => {
  const check = process.argv.includes("--check");

  const report: BenchmarkReport = {
    generatedAt: new Date().toISOString(),
    renderLatencyByTier: await renderTierBenchmark(),
    apiLatencyByDiagramCount: await apiLatencyBenchmark(),
    idleNetworkQuiet: await idleQuietBenchmark()
  };

  const outputDir = join(process.cwd(), "artifacts", "performance");
  await ensureDirectory(outputDir);
  await writeFile(
    join(outputDir, "phase-5-baseline.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  await writeFile(join(outputDir, "phase-5-baseline.md"), toMarkdown(report), "utf8");

  if (check) {
    failOnThresholds(report);
  }

  console.log(JSON.stringify(report, null, 2));
};

await main();
