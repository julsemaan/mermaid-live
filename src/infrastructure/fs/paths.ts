import { access, mkdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { DiagramSource } from "../../domain/Diagram.js";

export const ensureDirectory = async (targetPath: string): Promise<void> => {
  await mkdir(targetPath, { recursive: true });
};

export const ensureReadableDirectory = async (targetPath: string): Promise<void> => {
  const details = await stat(targetPath);
  if (!details.isDirectory()) {
    throw new Error("Path is not a directory");
  }
  await access(targetPath, constants.R_OK);
};

export const toAbsolutePath = (pathValue: string): string => resolve(pathValue);

export const resolveOutputPathForDiagram = async (
  outputRootPath: string,
  source: DiagramSource
): Promise<string> => {
  const outputPath = resolveOutputPathForRelativeSourcePath(outputRootPath, source.relativePath);
  await ensureDirectory(dirname(outputPath));
  return outputPath;
};

export const resolveOutputPathForRelativeSourcePath = (
  outputRootPath: string,
  relativeSourcePath: string
): string => {
  const normalizedRelativePath = relativeSourcePath.replace(/\.(mmd|mermaid)$/i, ".svg");
  return join(outputRootPath, normalizedRelativePath);
};

export const relativePathFromRoot = (rootPath: string, absolutePath: string): string => {
  return relative(resolve(rootPath), resolve(absolutePath));
};
