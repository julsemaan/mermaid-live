import { z } from "zod";
import {
  ensureDirectory,
  ensureReadableDirectory,
  toAbsolutePath
} from "../infrastructure/fs/paths.js";
import type { LogLevel } from "../infrastructure/logging/logger.js";

export interface RuntimeConfig {
  inputPath: string;
  outputPath: string;
  port: number;
  logLevel: LogLevel;
}

export interface RawConfigInput {
  input?: string;
  output?: string;
  port?: number;
  logLevel?: string;
}

const logLevelSchema = z.enum(["fatal", "error", "warn", "info", "debug", "trace"]);

const configSchema = z.object({
  input: z.string().min(1),
  output: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  logLevel: logLevelSchema
});

const parsePort = (value: string | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return undefined;
  }
  return parsed;
};

const environmentDefaults = (): RawConfigInput => ({
  input: process.env.INPUT_DIR,
  output: process.env.OUT_DIR,
  port: parsePort(process.env.PORT),
  logLevel: process.env.LOG_LEVEL
});

export const normalizeConfig = async (raw: RawConfigInput): Promise<RuntimeConfig> => {
  const defaults = environmentDefaults();

  const input = raw.input ?? defaults.input ?? ".";
  const output = raw.output ?? defaults.output ?? "./.mermaid-live-out";
  const port = raw.port ?? defaults.port ?? 18000;
  const logLevel = raw.logLevel ?? defaults.logLevel ?? "info";

  const parsed = configSchema.safeParse({
    input,
    output,
    port,
    logLevel
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid configuration: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`
    );
  }

  const normalized: RuntimeConfig = {
    inputPath: toAbsolutePath(parsed.data.input),
    outputPath: toAbsolutePath(parsed.data.output),
    port: parsed.data.port,
    logLevel: parsed.data.logLevel as LogLevel
  };

  await ensureReadableDirectory(normalized.inputPath).catch((error: unknown) => {
    throw new Error(
      `Input path must be a readable directory: ${normalized.inputPath} (${error instanceof Error ? error.message : String(error)})`
    );
  });

  await ensureDirectory(normalized.outputPath).catch((error: unknown) => {
    throw new Error(
      `Failed to create output directory: ${normalized.outputPath} (${error instanceof Error ? error.message : String(error)})`
    );
  });

  return normalized;
};
