import { createHash } from "node:crypto";

export const buildDiagramId = (relativePath: string): string => {
  return createHash("sha1").update(relativePath).digest("hex");
};
