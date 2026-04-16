import { DiagramCatalogService } from "../application/services/DiagramCatalogService.js";
import { EventIngestionService } from "../application/services/EventIngestionService.js";
import { ManifestService } from "../application/services/ManifestService.js";
import { RenderService } from "../application/services/RenderService.js";
import { RenderQueueService } from "../application/services/RenderQueueService.js";
import { normalizeConfig, type RawConfigInput } from "./config.js";
import {
  createDiagramDiscoveredEvent,
  createDiagramRemovedEvent,
  createDiagramRenderedEvent,
  createRenderFailedEvent
} from "../domain/events.js";
import type { RenderError } from "../domain/RenderResult.js";
import type { QueueEvent } from "../domain/QueueEvent.js";
import { SourceWatcher } from "../infrastructure/fs/SourceWatcher.js";
import { createLogger } from "../infrastructure/logging/logger.js";
import { MermaidCliRenderer } from "../infrastructure/mermaid/MermaidCliRenderer.js";
import {
  relativePathFromRoot,
  resolveOutputPathForDiagram,
  resolveOutputPathForRelativeSourcePath
} from "../infrastructure/fs/paths.js";
import { isAbsolute } from "node:path";

const toErrorSummary = (error: RenderError): string => {
  switch (error.kind) {
    case "source-invalid":
      return error.message;
    case "renderer-failed":
      return [error.message, error.stderrSummary].filter(Boolean).join(" | ");
    case "io-failed":
      return [error.message, error.cause].filter(Boolean).join(" | ");
    default: {
      const unhandled: never = error;
      return String(unhandled);
    }
  }
};

const waitForShutdownSignal = (): Promise<NodeJS.Signals> => {
  return new Promise<NodeJS.Signals>((resolve) => {
    let handled = false;

    const onSignal = (signal: NodeJS.Signals) => {
      if (handled) {
        return;
      }
      handled = true;
      resolve(signal);
    };

    process.once("SIGINT", () => onSignal("SIGINT"));
    process.once("SIGTERM", () => onSignal("SIGTERM"));
  });
};

export const bootstrap = async (rawConfig: RawConfigInput): Promise<number> => {
  const config = await normalizeConfig(rawConfig);
  const logger = createLogger(config.logLevel);
  const catalogService = new DiagramCatalogService();
  const renderService = new RenderService(new MermaidCliRenderer());
  const manifestService = new ManifestService(config.outputPath);

  let successCount = 0;
  let failureCount = 0;

  const handleQueueEvent = async (event: QueueEvent): Promise<void> => {
    if (event.type === "deleted") {
      const relativePath = relativePathFromRoot(config.inputPath, event.sourcePath);
      if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
        logger.warn(
          {
            diagramId: event.diagramId,
            sourcePath: event.sourcePath,
            relativePath
          },
          "Ignored delete event outside configured input root"
        );
        return;
      }

      const fallbackArtifactPath = resolveOutputPathForRelativeSourcePath(
        config.outputPath,
        relativePath
      );
      await manifestService.removeDiagram(event.diagramId, fallbackArtifactPath);

      const removedEvent = createDiagramRemovedEvent(event.diagramId, event.sourcePath);
      logger.info(
        {
          eventId: removedEvent.eventId,
          eventType: removedEvent.type,
          diagramId: event.diagramId,
          sourcePath: event.sourcePath,
          outputPath: fallbackArtifactPath
        },
        "Diagram removed"
      );
      return;
    }

    try {
      const source = await catalogService.readSource(config.inputPath, event.sourcePath);
      if (!source) {
        return;
      }

      const outputPath = await resolveOutputPathForDiagram(config.outputPath, source);
      const result = await renderService.renderOne(source, outputPath);

      if (result.ok) {
        successCount += 1;
        await manifestService.upsertRendered(result.source, result.artifact.outputPath);
        const renderedEvent = createDiagramRenderedEvent(
          result.source,
          result.artifact,
          result.durationMs
        );
        logger.info(
          {
            eventId: renderedEvent.eventId,
            eventType: renderedEvent.type,
            diagramId: result.diagramId,
            durationMs: result.durationMs,
            outputPath: result.artifact.outputPath,
            stderrSummary: result.stderrSummary
          },
          "Diagram rendered"
        );
        return;
      }

      failureCount += 1;
      await manifestService.markFailed(source, outputPath, toErrorSummary(result.error));
      const failedEvent = createRenderFailedEvent(result.source, result.error, result.durationMs);
      logger.error(
        {
          eventId: failedEvent.eventId,
          eventType: failedEvent.type,
          diagramId: result.diagramId,
          durationMs: result.durationMs,
          error: result.error
        },
        "Diagram render failed"
      );
    } catch (error) {
      failureCount += 1;
      logger.error(
        {
          diagramId: event.diagramId,
          sourcePath: event.sourcePath,
          error: error instanceof Error ? error.message : String(error)
        },
        "Failed to process queue event"
      );
    }
  };

  const queueService = new RenderQueueService({
    concurrency: config.renderConcurrency,
    handleEvent: handleQueueEvent
  });

  const ingestionService = new EventIngestionService({
    debounceWindowMs: config.watcherDebounceMs,
    onFlush: (events) => {
      for (const event of events) {
        queueService.enqueue(event);
      }
    }
  });

  const watcher = new SourceWatcher({
    inputRootPath: config.inputPath,
    onEvent: (event) => {
      ingestionService.ingest(event);
    },
    onError: (error) => {
      logger.error({ error: error.message }, "Source watcher error");
    }
  });

  logger.info(
    {
      inputPath: config.inputPath,
      outputPath: config.outputPath,
      port: config.port,
      logLevel: config.logLevel,
      watcherDebounceMs: config.watcherDebounceMs,
      renderConcurrency: config.renderConcurrency,
      manifestPath: manifestService.getManifestPath()
    },
    "Starting watcher runtime"
  );

  const diagrams = await catalogService.discover(config.inputPath);

  for (const diagram of diagrams) {
    const discoveredEvent = createDiagramDiscoveredEvent(diagram);
    logger.debug(
      {
        eventId: discoveredEvent.eventId,
        eventType: discoveredEvent.type,
        diagramId: diagram.id,
        sourcePath: diagram.relativePath
      },
      "Diagram discovered"
    );
  }

  logger.info({ discoveredCount: diagrams.length }, "Discovery complete");

  for (const diagram of diagrams) {
    ingestionService.ingest({
      type: "created",
      diagramId: diagram.id,
      sourcePath: diagram.absolutePath
    });
  }

  ingestionService.flushNow();
  await queueService.waitForIdle();

  await manifestService.persist();

  await watcher.start();

  logger.info(
    {
      renderedCount: successCount,
      failureCount,
      manifestPath: manifestService.getManifestPath()
    },
    "Initial render and manifest sync complete"
  );

  logger.info("Watching for incremental changes");

  const signal = await waitForShutdownSignal();
  logger.info({ signal }, "Shutdown signal received");

  ingestionService.flushNow();
  await queueService.waitForIdle();
  await watcher.close();

  logger.info(
    {
      successCount,
      failureCount,
      outputPath: config.outputPath
    },
    "Watcher runtime stopped"
  );

  return failureCount > 0 ? 1 : 0;
};
