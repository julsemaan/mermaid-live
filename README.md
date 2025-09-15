# Mermaid live

Simple docker image to build, render and serve Mermaid diagrams. Supports live rebuilding and reloading within the browser.

## Usage

NOTE: Change `~/path/to/diagrams/` to the path where your Mermaid diagrams are stored.

```bash
docker run -p 18000:18000 -v ~/path/to/diagrams/:/diagrams julsemaan/mermaid-live:2025-09-15-1
```

Then, open your browser at `http://localhost:18000`.

