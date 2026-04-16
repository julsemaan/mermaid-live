import type { DiagramRealtimeEvent } from "../../domain/realtime.js";

export type RealtimeEventListener = (event: DiagramRealtimeEvent) => void;

export class RealtimeEventBus {
  private readonly listeners = new Set<RealtimeEventListener>();

  public subscribe(listener: RealtimeEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public publish(event: DiagramRealtimeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
