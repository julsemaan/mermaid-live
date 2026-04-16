import pino, { type Logger } from "pino";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

export const createLogger = (level: LogLevel): Logger => {
  return pino({
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: undefined
  });
};
