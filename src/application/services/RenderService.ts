import type { DiagramSource } from "../../domain/Diagram.js";
import type { RenderResult } from "../../domain/RenderResult.js";

export interface Renderer {
  render(source: DiagramSource, outputPath: string): Promise<RenderResult>;
}

export class RenderService {
  public constructor(private readonly renderer: Renderer) {}

  public async renderOne(source: DiagramSource, outputPath: string): Promise<RenderResult> {
    return this.renderer.render(source, outputPath);
  }

  public async renderAll(
    sources: DiagramSource[],
    resolveOutputPath: (source: DiagramSource) => Promise<string>
  ) {
    const results: RenderResult[] = [];
    for (const source of sources) {
      const outputPath = await resolveOutputPath(source);
      const result = await this.renderer.render(source, outputPath);
      results.push(result);
    }
    return results;
  }
}
