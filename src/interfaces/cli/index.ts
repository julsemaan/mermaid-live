import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { RawConfigInput } from "../../app/config.js";

interface CliArgs {
  input?: string;
  output?: string;
  port?: number;
  logLevel?: string;
}

export const parseCliArgs = async (
  argv: string[] = hideBin(process.argv)
): Promise<RawConfigInput> => {
  const parsed = await yargs(argv)
    .scriptName("mermaid-live")
    .usage("$0 [options]")
    .option("input", {
      alias: "i",
      type: "string",
      description: "Input directory with Mermaid source files"
    })
    .option("output", {
      alias: "o",
      type: "string",
      description: "Output directory for rendered diagrams"
    })
    .option("port", {
      alias: "p",
      type: "number",
      description: "Port reserved for viewer service"
    })
    .option("log-level", {
      type: "string",
      description: "Log level (fatal,error,warn,info,debug,trace)"
    })
    .strict()
    .help()
    .parseAsync();

  const args = parsed as unknown as CliArgs & { "log-level"?: string };
  return {
    input: args.input,
    output: args.output,
    port: args.port,
    logLevel: args.logLevel ?? args["log-level"]
  };
};
