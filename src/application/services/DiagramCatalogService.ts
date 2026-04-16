import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { DiagramSource } from "../../domain/Diagram.js";

const SUPPORTED_EXTENSIONS = new Set([".mmd", ".mermaid"]);

const buildDiagramId = (relativePath: string): string => {
  return createHash("sha1").update(relativePath).digest("hex");
};

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
  public async discover(inputRootPath: string): Promise<DiagramSource[]> {
    const absoluteInputPath = resolve(inputRootPath);
    const allFiles = await listFilesRecursively(absoluteInputPath);
    const candidateFiles = allFiles.filter((filePath) => {
      const normalized = filePath.toLowerCase();
      return [...SUPPORTED_EXTENSIONS].some((extension) => normalized.endsWith(extension));
    });

    const diagrams = await Promise.all(
      candidateFiles.map(async (absolutePath) => {
        const fileStat = await stat(absolutePath);
        const relativePath = relative(absoluteInputPath, absolutePath);
        const extension = absolutePath.toLowerCase().endsWith(".mermaid") ? "mermaid" : "mmd";

        const source: DiagramSource = {
          id: buildDiagramId(relativePath),
          absolutePath,
          relativePath,
          extension,
          metadata: {
            sourceMtimeMs: fileStat.mtimeMs,
            sourceSizeBytes: fileStat.size
          }
        };

        return source;
      })
    );

    return diagrams.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  }
}
