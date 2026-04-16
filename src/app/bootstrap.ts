import { DiagramCatalogService } from "../application/services/DiagramCatalogService.js";
import { RenderService } from "../application/services/RenderService.js";
import { normalizeConfig, type RawConfigInput } from "./config.js";
import {
  createDiagramDiscoveredEvent,
  createDiagramRenderedEvent,
  createRenderFailedEvent
} from "../domain/events.js";
import { createLogger } from "../infrastructure/logging/logger.js";
import { MermaidCliRenderer } from "../infrastructure/mermaid/MermaidCliRenderer.js";
import { resolveOutputPathForDiagram } from "../infrastructure/fs/paths.js";

export const bootstrap = async (rawConfig: RawConfigInput): Promise<number> => {
  const config = await normalizeConfig(rawConfig);
  const logger = createLogger(config.logLevel);
  const catalogService = new DiagramCatalogService();
  const renderService = new RenderService(new MermaidCliRenderer());

  logger.info(
    {
      inputPath: config.inputPath,
      outputPath: config.outputPath,
      port: config.port,
      logLevel: config.logLevel
    },
    "Starting render run"
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

  const results = await renderService.renderAll(diagrams, (source) =>
    resolveOutputPathForDiagram(config.outputPath, source)
  );

  let successCount = 0;
  let failureCount = 0;

  for (const result of results) {
    if (result.ok) {
      successCount += 1;
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
      continue;
    }

    failureCount += 1;
    const failureEvent = createRenderFailedEvent(result.source, result.error, result.durationMs);
    logger.error(
      {
        eventId: failureEvent.eventId,
        eventType: failureEvent.type,
        diagramId: result.diagramId,
        durationMs: result.durationMs,
        error: result.error
      },
      "Diagram render failed"
    );
  }

  logger.info(
    {
      total: results.length,
      successCount,
      failureCount,
      outputPath: config.outputPath
    },
    "Render run complete"
  );

  return failureCount > 0 ? 1 : 0;
};
