import type { QueueEvent, QueueEventType } from "../../domain/QueueEvent.js";

interface IngestionInput {
  type: QueueEventType;
  diagramId: string;
  sourcePath: string;
}

interface EventIngestionServiceOptions {
  debounceWindowMs: number;
  onFlush: (events: QueueEvent[]) => void;
}

const mergeType = (current: QueueEventType, incoming: QueueEventType): QueueEventType => {
  if (current === "deleted" || incoming === "deleted") {
    return "deleted";
  }

  if (current === "created" || incoming === "created") {
    return "created";
  }

  return "changed";
};

export class EventIngestionService {
  private readonly debounceWindowMs: number;
  private readonly onFlush: (events: QueueEvent[]) => void;
  private readonly pendingByDiagram = new Map<string, QueueEvent>();
  private nextSequence = 1;
  private flushTimer: NodeJS.Timeout | null = null;

  public constructor(options: EventIngestionServiceOptions) {
    this.debounceWindowMs = options.debounceWindowMs;
    this.onFlush = options.onFlush;
  }

  public ingest(input: IngestionInput): void {
    const existing = this.pendingByDiagram.get(input.diagramId);
    const event: QueueEvent = {
      type: existing ? mergeType(existing.type, input.type) : input.type,
      diagramId: input.diagramId,
      sourcePath: input.sourcePath,
      timestamp: new Date().toISOString(),
      sequence: this.nextSequence
    };

    this.nextSequence += 1;
    this.pendingByDiagram.set(input.diagramId, event);
    this.scheduleFlush();
  }

  public flushNow(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const events = [...this.pendingByDiagram.values()].sort((left, right) =>
      left.sequence === right.sequence
        ? left.diagramId.localeCompare(right.diagramId)
        : left.sequence - right.sequence
    );

    this.pendingByDiagram.clear();

    if (events.length > 0) {
      this.onFlush(events);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushNow();
    }, this.debounceWindowMs);
  }
}
