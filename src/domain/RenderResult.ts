import type { DiagramArtifact, DiagramId, DiagramSource } from "./Diagram.js";

export type RenderError =
  | {
      kind: "source-invalid";
      message: string;
    }
  | {
      kind: "renderer-failed";
      message: string;
      exitCode: number | null;
      stderrSummary?: string;
      stdoutSummary?: string;
    }
  | {
      kind: "io-failed";
      message: string;
      operation: "read" | "write" | "mkdir" | "spawn" | "stat";
      cause?: string;
    };

export type RenderResult =
  | {
      ok: true;
      diagramId: DiagramId;
      source: DiagramSource;
      artifact: DiagramArtifact;
      durationMs: number;
      stderrSummary?: string;
    }
  | {
      ok: false;
      diagramId: DiagramId;
      source: DiagramSource;
      durationMs: number;
      error: RenderError;
    };
