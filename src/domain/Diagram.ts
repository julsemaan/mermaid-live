export type DiagramId = string;

export interface DiagramMetadata {
  sourceMtimeMs: number;
  sourceSizeBytes: number;
}

export interface DiagramSource {
  id: DiagramId;
  absolutePath: string;
  relativePath: string;
  extension: "mmd" | "mermaid";
  metadata: DiagramMetadata;
}

export interface DiagramArtifact {
  diagramId: DiagramId;
  outputPath: string;
  format: "svg";
}
