import { randomUUID } from "node:crypto";
import type { DiagramArtifact, DiagramId, DiagramSource } from "./Diagram.js";
import type { RenderError } from "./RenderResult.js";

interface BaseDomainEvent {
  eventId: string;
  type: "DiagramDiscovered" | "DiagramRendered" | "DiagramRemoved" | "RenderFailed";
  at: string;
  diagramId: DiagramId;
}

export interface DiagramDiscoveredEvent extends BaseDomainEvent {
  type: "DiagramDiscovered";
  source: DiagramSource;
}

export interface DiagramRenderedEvent extends BaseDomainEvent {
  type: "DiagramRendered";
  source: DiagramSource;
  artifact: DiagramArtifact;
  durationMs: number;
}

export interface DiagramRemovedEvent extends BaseDomainEvent {
  type: "DiagramRemoved";
  sourcePath: string;
}

export interface RenderFailedEvent extends BaseDomainEvent {
  type: "RenderFailed";
  source: DiagramSource;
  durationMs: number;
  error: RenderError;
}

export type DomainEvent =
  | DiagramDiscoveredEvent
  | DiagramRenderedEvent
  | DiagramRemovedEvent
  | RenderFailedEvent;

const nextBase = <T extends DomainEvent["type"]>(
  type: T,
  diagramId: DiagramId
): BaseDomainEvent & { type: T } => ({
  eventId: randomUUID(),
  type,
  at: new Date().toISOString(),
  diagramId
});

export const createDiagramDiscoveredEvent = (source: DiagramSource): DiagramDiscoveredEvent => ({
  ...nextBase("DiagramDiscovered", source.id),
  source
});

export const createDiagramRenderedEvent = (
  source: DiagramSource,
  artifact: DiagramArtifact,
  durationMs: number
): DiagramRenderedEvent => ({
  ...nextBase("DiagramRendered", source.id),
  source,
  artifact,
  durationMs
});

export const createRenderFailedEvent = (
  source: DiagramSource,
  error: RenderError,
  durationMs: number
): RenderFailedEvent => ({
  ...nextBase("RenderFailed", source.id),
  source,
  error,
  durationMs
});
