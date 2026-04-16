import { rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { DiagramSource } from "../../domain/Diagram.js";
import type {
  DiagramManifestDocument,
  DiagramManifestEntry,
  DiagramManifestStatus
} from "../../domain/Manifest.js";
import {
  ensureDirectory,
  resolveOutputPathForRelativeSourcePath
} from "../../infrastructure/fs/paths.js";

interface UpsertInput {
  source: DiagramSource;
  outputPath: string;
  status: DiagramManifestStatus;
  lastError?: string;
}

export class ManifestService {
  private readonly outputRootPath: string;
  private readonly manifestPath: string;
  private readonly entries = new Map<string, DiagramManifestEntry>();
  private writeChain: Promise<void> = Promise.resolve();

  public constructor(outputRootPath: string) {
    this.outputRootPath = resolve(outputRootPath);
    this.manifestPath = resolve(this.outputRootPath, "manifest.json");
  }

  public getManifestPath(): string {
    return this.manifestPath;
  }

  public getEntry(diagramId: string): DiagramManifestEntry | undefined {
    return this.entries.get(diagramId);
  }

  public async persist(): Promise<void> {
    await this.persistAtomically();
  }

  public async upsertRendered(source: DiagramSource, outputPath: string): Promise<void> {
    this.upsertEntry({ source, outputPath, status: "ready" });
    await this.persistAtomically();
  }

  public async markFailed(
    source: DiagramSource,
    outputPath: string,
    lastError: string
  ): Promise<void> {
    this.upsertEntry({ source, outputPath, status: "failed", lastError });
    await this.persistAtomically();
  }

  public async removeDiagram(diagramId: string, fallbackArtifactPath?: string): Promise<void> {
    const previous = this.entries.get(diagramId);
    this.entries.delete(diagramId);

    const artifactPath = previous?.svgPath ?? fallbackArtifactPath;
    if (artifactPath) {
      await rm(artifactPath, { force: true });
    }

    await this.persistAtomically();
  }

  private upsertEntry(input: UpsertInput): void {
    const version = `${Math.trunc(input.source.metadata.sourceMtimeMs)}-${input.source.metadata.sourceSizeBytes}`;
    const previous = this.entries.get(input.source.id);
    const entry: DiagramManifestEntry = {
      id: input.source.id,
      sourcePath: input.source.absolutePath,
      svgPath: input.outputPath,
      version,
      updatedAt: new Date().toISOString(),
      status: input.status,
      lastError: input.lastError ?? (input.status === "failed" ? previous?.lastError : undefined)
    };

    if (input.status === "ready") {
      delete entry.lastError;
    }

    this.entries.set(input.source.id, entry);
  }

  private async persistAtomically(): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      const document: DiagramManifestDocument = {
        generatedAt: new Date().toISOString(),
        diagrams: [...this.entries.values()].sort((left, right) =>
          left.sourcePath.localeCompare(right.sourcePath)
        )
      };

      await ensureDirectory(dirname(this.manifestPath));
      const temporaryPath = `${this.manifestPath}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
      await rename(temporaryPath, this.manifestPath);
    });

    await this.writeChain;
  }

  public resolveOutputPathForSource(source: DiagramSource): string {
    return resolveOutputPathForRelativeSourcePath(this.outputRootPath, source.relativePath);
  }
}
