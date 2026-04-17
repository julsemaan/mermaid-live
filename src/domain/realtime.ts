import type { DiagramManifestStatus } from "./Manifest.js";

export type DiagramRealtimeEventType =
  | "diagram.created"
  | "diagram.updated"
  | "diagram.deleted"
  | "diagram.failed";

export type DiagramRealtimeStatus = DiagramManifestStatus | "deleted";

export interface DiagramRealtimePayload {
  eventId?: string;
  id: string;
  version: string;
  updatedAt: string;
  status: DiagramRealtimeStatus;
  reason?: string;
}

export interface DiagramRealtimeEvent {
  type: DiagramRealtimeEventType;
  payload: DiagramRealtimePayload;
}
