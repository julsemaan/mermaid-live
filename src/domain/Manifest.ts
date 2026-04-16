export type DiagramManifestStatus = "ready" | "failed";

export interface DiagramManifestEntry {
  id: string;
  sourcePath: string;
  svgPath: string;
  version: string;
  updatedAt: string;
  status: DiagramManifestStatus;
  lastError?: string;
}

export interface DiagramManifestDocument {
  generatedAt: string;
  diagrams: DiagramManifestEntry[];
}
