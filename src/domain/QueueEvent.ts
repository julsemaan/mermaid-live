export type QueueEventType = "created" | "changed" | "deleted";

export interface QueueEvent {
  type: QueueEventType;
  diagramId: string;
  sourcePath: string;
  timestamp: string;
  sequence: number;
}
