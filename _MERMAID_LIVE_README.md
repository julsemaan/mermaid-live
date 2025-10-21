# Mermaid live

Simple docker image to build, render and serve Mermaid diagrams. Supports live rebuilding and reloading within the browser.

## Usage

NOTE: Change `~/path/to/diagrams/` to the path where your Mermaid diagrams are stored.

```bash
docker run -p 18000:18000 -v ~/path/to/diagrams/:/diagrams julsemaan/mermaid-live:2025-10-21
```

If you want the rendered diagrams to be saved to the same directory as the source diagrams are in, use the `OUT_DIR` environment variable:

```bash
docker run -p 18000:18000 -v ~/path/to/diagrams/:/diagrams -e OUT_DIR=/diagrams/ julsemaan/mermaid-live:2025-10-21
```

Then, open your browser at `http://localhost:18000`.

