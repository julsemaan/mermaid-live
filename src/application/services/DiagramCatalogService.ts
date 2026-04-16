import { readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { DiagramSource } from "../../domain/Diagram.js";
import { buildDiagramId } from "../../domain/diagramId.js";

const SUPPORTED_EXTENSIONS = new Set([".mmd", ".mermaid"]);

const listFilesRecursively = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const allNested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        return listFilesRecursively(absolutePath);
      }
      return entry.isFile() ? [absolutePath] : [];
    })
  );

  return allNested.flat();
};

export class DiagramCatalogService {
  public async readSource(
    inputRootPath: string,
    absolutePath: string
  ): Promise<DiagramSource | null> {
    const absoluteInputPath = resolve(inputRootPath);
    const normalized = absolutePath.toLowerCase();
    if (![...SUPPORTED_EXTENSIONS].some((extension) => normalized.endsWith(extension))) {
      return null;
    }

    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      return null;
    }

    const relativePath = relative(absoluteInputPath, absolutePath);
    const extension = absolutePath.toLowerCase().endsWith(".mermaid") ? "mermaid" : "mmd";

    return {
      id: buildDiagramId(relativePath),
      absolutePath,
      relativePath,
      extension,
      metadata: {
        sourceMtimeMs: fileStat.mtimeMs,
        sourceSizeBytes: fileStat.size
      }
    };
  }

  public async discover(inputRootPath: string): Promise<DiagramSource[]> {
    const absoluteInputPath = resolve(inputRootPath);
    const allFiles = await listFilesRecursively(absoluteInputPath);
    const candidateFiles = allFiles.filter((filePath) => {
      const normalized = filePath.toLowerCase();
      return [...SUPPORTED_EXTENSIONS].some((extension) => normalized.endsWith(extension));
    });

    const diagrams = await Promise.all(
      candidateFiles.map(async (absolutePath) => {
        const source = await this.readSource(absoluteInputPath, absolutePath);
        if (!source) {
          throw new Error(`Expected discoverable diagram source at path: ${absolutePath}`);
        }
        return source;
      })
    );

    return diagrams.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  }
}
