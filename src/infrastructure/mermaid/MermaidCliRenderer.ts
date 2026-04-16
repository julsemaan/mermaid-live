import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DiagramSource } from "../../domain/Diagram.js";
import type { RenderResult } from "../../domain/RenderResult.js";
import type { Renderer } from "../../application/services/RenderService.js";

interface MermaidCliRendererOptions {
  command?: string;
  timeoutMs?: number;
}

interface CommandExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

const summarize = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length <= 500) {
    return trimmed;
  }
  return `${trimmed.slice(0, 500)}...`;
};

export class MermaidCliRenderer implements Renderer {
  private readonly command: string;
  private readonly timeoutMs: number;

  public constructor(options: MermaidCliRendererOptions = {}) {
    this.command = options.command ?? "mmdc";
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  private async execute(command: string, args: string[]): Promise<CommandExecutionResult> {
    return new Promise<CommandExecutionResult>((resolve, reject) => {
      const child = spawn(command, args);

      let stdoutBuffer = "";
      let stderrBuffer = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, this.timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBuffer += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderrBuffer += chunk.toString();
      });

      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (timedOut) {
          reject(new Error(`Renderer timed out after ${this.timeoutMs}ms`));
          return;
        }
        resolve({ exitCode: code, stdout: stdoutBuffer, stderr: stderrBuffer });
      });
    });
  }

  public async render(source: DiagramSource, outputPath: string): Promise<RenderResult> {
    const start = performance.now();

    const tempDirectory = await mkdtemp(join(tmpdir(), "mermaid-live-"));
    const puppeteerConfigPath = join(tempDirectory, "puppeteer-config.json");

    try {
      await writeFile(
        puppeteerConfigPath,
        JSON.stringify({ args: ["--no-sandbox", "--disable-setuid-sandbox"] })
      );

      const baseArgs = [
        "-i",
        source.absolutePath,
        "-o",
        outputPath,
        "--puppeteerConfigFile",
        puppeteerConfigPath
      ];

      const attempts: Array<{ command: string; args: string[] }> = [
        { command: this.command, args: baseArgs },
        { command: join(process.cwd(), "node_modules", ".bin", "mmdc"), args: baseArgs },
        { command: "npx", args: ["--yes", "@mermaid-js/mermaid-cli", ...baseArgs] }
      ];

      let execution: CommandExecutionResult | undefined;
      let commandNotFoundCount = 0;

      for (const attempt of attempts) {
        try {
          execution = await this.execute(attempt.command, attempt.args);
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes("ENOENT")) {
            commandNotFoundCount += 1;
            continue;
          }
          throw error;
        }
      }

      if (!execution) {
        const installHint =
          "Mermaid CLI not found. Install it globally (`npm i -g @mermaid-js/mermaid-cli`) or locally in this repo (`npm i -D @mermaid-js/mermaid-cli`).";
        return {
          ok: false,
          diagramId: source.id,
          source,
          durationMs: Math.round(performance.now() - start),
          error: {
            kind: "io-failed",
            message: "Failed to execute Mermaid CLI renderer",
            operation: "spawn",
            cause:
              commandNotFoundCount > 0 ? installHint : "Renderer command failed before execution"
          }
        };
      }

      const { exitCode, stdout, stderr } = execution;

      const durationMs = Math.round(performance.now() - start);

      if (exitCode !== 0) {
        if (
          stderr.includes("Failed to launch the browser process") ||
          stderr.includes("error while loading shared libraries")
        ) {
          return {
            ok: false,
            diagramId: source.id,
            source,
            durationMs,
            error: {
              kind: "io-failed",
              message: "Mermaid renderer browser dependency is missing",
              operation: "spawn",
              cause:
                "Install Chromium runtime libs (for example: libnss3, libatk-bridge2.0-0, libatk1.0-0, libcups2, libdrm2, libxkbcommon0, libxcomposite1, libxdamage1, libxfixes3, libxrandr2, libgbm1, libpangocairo-1.0-0, libpango-1.0-0, libcairo2, libasound2)."
            }
          };
        }

        return {
          ok: false,
          diagramId: source.id,
          source,
          durationMs,
          error: {
            kind: "renderer-failed",
            message: `mmdc exited with code ${String(exitCode)}`,
            exitCode,
            stdoutSummary: summarize(stdout),
            stderrSummary: summarize(stderr)
          }
        };
      }

      return {
        ok: true,
        diagramId: source.id,
        source,
        artifact: {
          diagramId: source.id,
          outputPath,
          format: "svg"
        },
        durationMs,
        stderrSummary: summarize(stderr)
      };
    } catch (error) {
      return {
        ok: false,
        diagramId: source.id,
        source,
        durationMs: Math.round(performance.now() - start),
        error: {
          kind: "io-failed",
          message: "Failed to execute Mermaid CLI renderer",
          operation: "spawn",
          cause: error instanceof Error ? error.message : String(error)
        }
      };
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }
}
