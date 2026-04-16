import type { DiagramManifestEntry } from "../../domain/Manifest.js";

export interface DiagramSummaryDto {
  id: string;
  version: string;
  updatedAt: string;
  status: "ready" | "failed";
  svgUrl: string;
}

export interface DiagramDetailDto extends DiagramSummaryDto {
  sourcePath: string;
  lastError?: string;
}

export interface ApiErrorDto {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, string>;
  };
}

export const toDiagramSummaryDto = (entry: DiagramManifestEntry): DiagramSummaryDto => ({
  id: entry.id,
  version: entry.version,
  updatedAt: entry.updatedAt,
  status: entry.status,
  svgUrl: `/api/diagrams/${encodeURIComponent(entry.id)}/svg`
});

export const toDiagramDetailDto = (entry: DiagramManifestEntry): DiagramDetailDto => ({
  ...toDiagramSummaryDto(entry),
  sourcePath: entry.sourcePath,
  lastError: entry.lastError
});
