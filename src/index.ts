#!/usr/bin/env node
import { bootstrap } from "./app/bootstrap.js";
import { parseCliArgs } from "./interfaces/cli/index.js";

const main = async (): Promise<void> => {
  const args = await parseCliArgs();
  const exitCode = await bootstrap(args);
  process.exitCode = exitCode;
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to start mermaid-live: ${message}`);
  process.exitCode = 1;
});
