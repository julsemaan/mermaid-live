import type { QueueEvent } from "../../domain/QueueEvent.js";

interface RenderQueueServiceOptions {
  concurrency: number;
  handleEvent: (event: QueueEvent) => Promise<void>;
}

interface IdleWaiter {
  resolve: () => void;
}

export class RenderQueueService {
  private readonly handleEvent: (event: QueueEvent) => Promise<void>;
  private readonly concurrency: number;
  private readonly pendingByDiagram = new Map<string, QueueEvent>();
  private readonly inFlightDiagrams = new Set<string>();
  private readonly idleWaiters: IdleWaiter[] = [];
  private runningCount = 0;

  public constructor(options: RenderQueueServiceOptions) {
    this.handleEvent = options.handleEvent;
    this.concurrency = Math.max(1, Math.floor(options.concurrency));
  }

  public enqueue(event: QueueEvent): void {
    if (this.inFlightDiagrams.has(event.diagramId)) {
      this.pendingByDiagram.set(event.diagramId, event);
      return;
    }

    this.pendingByDiagram.set(event.diagramId, event);
    this.drain();
  }

  public async waitForIdle(): Promise<void> {
    if (this.runningCount === 0 && this.pendingByDiagram.size === 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.idleWaiters.push({ resolve });
    });
  }

  public getQueueDepth(): number {
    return this.pendingByDiagram.size + this.runningCount;
  }

  private drain(): void {
    while (this.runningCount < this.concurrency) {
      const nextEvent = this.takeNextEvent();
      if (!nextEvent) {
        this.notifyIdleIfNeeded();
        return;
      }

      this.pendingByDiagram.delete(nextEvent.diagramId);
      this.inFlightDiagrams.add(nextEvent.diagramId);
      this.runningCount += 1;

      this.handleEvent(nextEvent)
        .catch(() => {
          return;
        })
        .finally(() => {
          this.inFlightDiagrams.delete(nextEvent.diagramId);
          this.runningCount -= 1;
          this.drain();
        });
    }
  }

  private takeNextEvent(): QueueEvent | null {
    let best: QueueEvent | null = null;
    for (const event of this.pendingByDiagram.values()) {
      if (!best || event.sequence < best.sequence) {
        best = event;
      }
    }
    return best;
  }

  private notifyIdleIfNeeded(): void {
    if (this.runningCount > 0 || this.pendingByDiagram.size > 0 || this.idleWaiters.length === 0) {
      return;
    }

    const waiters = this.idleWaiters.splice(0, this.idleWaiters.length);
    for (const waiter of waiters) {
      waiter.resolve();
    }
  }
}
