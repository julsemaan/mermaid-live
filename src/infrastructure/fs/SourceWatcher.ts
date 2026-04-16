import { watch, type FSWatcher } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { buildDiagramId } from "../../domain/diagramId.js";
import type { QueueEventType } from "../../domain/QueueEvent.js";

interface WatcherEvent {
  type: QueueEventType;
  diagramId: string;
  sourcePath: string;
}

export interface SourceWatcherOptions {
  inputRootPath: string;
  onEvent: (event: WatcherEvent) => void;
  onError?: (error: Error) => void;
}

const SUPPORTED_EXTENSIONS = [".mmd", ".mermaid"];

const isSupportedDiagramPath = (absolutePath: string): boolean => {
  const lowered = absolutePath.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => lowered.endsWith(extension));
};

const isIgnoredName = (name: string): boolean => {
  if (!name) {
    return true;
  }

  return (
    name.startsWith(".") ||
    name.endsWith("~") ||
    name.endsWith(".swp") ||
    name.endsWith(".swx") ||
    name.endsWith(".tmp") ||
    name.endsWith(".temp") ||
    name.endsWith(".crdownload")
  );
};

export class SourceWatcher {
  private readonly inputRootPath: string;
  private readonly onEvent: (event: WatcherEvent) => void;
  private readonly onError?: (error: Error) => void;
  private readonly watchers = new Map<string, FSWatcher>();
  private readonly knownPaths = new Set<string>();
  private started = false;

  public constructor(options: SourceWatcherOptions) {
    this.inputRootPath = resolve(options.inputRootPath);
    this.onEvent = options.onEvent;
    this.onError = options.onError;
  }

  public async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    await this.walkAndRegister(this.inputRootPath);
  }

  public async close(): Promise<void> {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    this.started = false;
  }

  private async walkAndRegister(directory: string): Promise<void> {
    await this.registerDirectoryWatcher(directory);

    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (isIgnoredName(entry.name)) {
        continue;
      }

      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await this.walkAndRegister(absolutePath);
        continue;
      }

      if (entry.isFile() && isSupportedDiagramPath(absolutePath)) {
        this.knownPaths.add(absolutePath);
      }
    }
  }

  private async registerDirectoryWatcher(directory: string): Promise<void> {
    const normalized = resolve(directory);
    if (this.watchers.has(normalized)) {
      return;
    }

    const watcher = watch(normalized, (eventType, fileName) => {
      const rawName = typeof fileName === "string" ? fileName : null;
      if (!rawName || isIgnoredName(rawName)) {
        return;
      }

      const absolutePath = resolve(normalized, rawName);
      this.handleFsEvent(eventType, absolutePath).catch((error: unknown) => {
        this.emitError(error);
      });
    });

    watcher.on("error", (error) => {
      this.emitError(error);
    });

    this.watchers.set(normalized, watcher);
  }

  private async handleFsEvent(eventType: string, absolutePath: string): Promise<void> {
    let details: Awaited<ReturnType<typeof stat>> | null = null;
    try {
      details = await stat(absolutePath);
    } catch {
      details = null;
    }

    if (details?.isDirectory()) {
      if (eventType === "rename") {
        await this.walkAndRegister(absolutePath);
      }
      return;
    }

    if (!isSupportedDiagramPath(absolutePath)) {
      return;
    }

    if (!details) {
      if (!this.knownPaths.has(absolutePath)) {
        return;
      }

      this.knownPaths.delete(absolutePath);
      this.emit("deleted", absolutePath);
      return;
    }

    if (!details.isFile()) {
      return;
    }

    const existed = this.knownPaths.has(absolutePath);
    this.knownPaths.add(absolutePath);

    if (eventType === "change") {
      this.emit("changed", absolutePath);
      return;
    }

    this.emit(existed ? "changed" : "created", absolutePath);
  }

  private emit(type: QueueEventType, absolutePath: string): void {
    const relativePath = relative(this.inputRootPath, absolutePath);
    const diagramId = buildDiagramId(relativePath);
    this.onEvent({ type, diagramId, sourcePath: absolutePath });
  }

  private emitError(error: unknown): void {
    const normalized = error instanceof Error ? error : new Error(String(error));
    if (this.onError) {
      this.onError(normalized);
    }
  }
}
