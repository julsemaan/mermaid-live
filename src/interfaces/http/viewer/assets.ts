export const viewerHtml = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mermaid Live Viewer</title>
    <link rel="stylesheet" href="/viewer.css" />
  </head>
  <body>
    <div id="app" class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <h1>Mermaid Live</h1>
          <p id="connection-indicator" class="connection online">Connected</p>
        </div>
        <label class="filter-label" for="diagram-filter">Search diagrams</label>
        <input id="diagram-filter" class="filter-input" type="search" placeholder="Filter by name or path" autocomplete="off" />
        <p id="diagram-count" class="diagram-count">0 diagrams</p>
        <nav id="diagram-nav" class="diagram-nav" aria-label="Diagrams"></nav>
      </aside>
      <main id="main-content" class="main-content" tabindex="-1"></main>
    </div>
    <script src="/viewer.js" defer></script>
  </body>
</html>
`;

export const viewerCss = String.raw`:root {
  --bg: #f3f0e8;
  --surface: #fffdf8;
  --surface-strong: #fff;
  --ink: #1f2933;
  --muted: #5f6b75;
  --line: #d8d1c0;
  --accent: #b2492d;
  --accent-strong: #7f2f1a;
  --ok: #247a49;
  --warn: #a04d11;
  --error: #9d1f25;
  --shadow: 0 8px 20px rgba(50, 40, 20, 0.08);
  --font-head: "Fraunces", Georgia, serif;
  --font-body: "Work Sans", "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

body {
  font-family: var(--font-body);
  color: var(--ink);
  background:
    radial-gradient(circle at 85% -20%, rgba(178, 73, 45, 0.2), transparent 60%),
    radial-gradient(circle at 0% 0%, rgba(36, 122, 73, 0.12), transparent 45%),
    var(--bg);
}

.app-shell {
  height: 100dvh;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 0;
}

.sidebar {
  border-right: 1px solid var(--line);
  background: linear-gradient(180deg, #fffdf8 0%, #f7f2e6 100%);
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.brand h1 {
  margin: 0;
  font-family: var(--font-head);
  letter-spacing: 0.01em;
  font-size: 1.55rem;
}

.connection {
  margin: 0.45rem 0 1rem;
  font-size: 0.86rem;
  padding: 0.3rem 0.55rem;
  border-radius: 999px;
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  width: fit-content;
}

.connection::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.connection.online {
  color: var(--ok);
  background: rgba(36, 122, 73, 0.12);
}

.connection.offline {
  color: var(--warn);
  background: rgba(160, 77, 17, 0.16);
}

.filter-label {
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.35rem;
}

.filter-input {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.65rem 0.7rem;
  font-size: 0.92rem;
  background: var(--surface-strong);
}

.diagram-count {
  color: var(--muted);
  font-size: 0.84rem;
  margin: 0.7rem 0;
}

.diagram-nav {
  overflow: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
  padding-bottom: 0.5rem;
}

.diagram-link {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.4rem;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
  background: var(--surface);
  padding: 0.5rem 0.6rem;
}

.diagram-link .name {
  font-size: 0.89rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diagram-link .chip {
  border-radius: 999px;
  font-size: 0.72rem;
  padding: 0.15rem 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.chip-ready {
  background: rgba(36, 122, 73, 0.16);
  color: var(--ok);
}

.chip-failed {
  background: rgba(157, 31, 37, 0.16);
  color: var(--error);
}

.diagram-link.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(178, 73, 45, 0.2);
}

.main-content {
  overflow: auto;
  min-height: 0;
  padding: 1rem 1.2rem 1.5rem;
}

.main-content.single-route {
  padding: 0.7rem;
}

.toolbar {
  display: flex;
  gap: 0.45rem;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 0.65rem;
}

.btn {
  border: 1px solid var(--line);
  background: var(--surface-strong);
  color: var(--ink);
  border-radius: 9px;
  padding: 0.45rem 0.68rem;
  font-size: 0.84rem;
  cursor: pointer;
}

.btn:hover {
  border-color: var(--accent);
}

.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.btn-primary:hover {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
}

.zoom-value {
  font-size: 0.84rem;
  color: var(--muted);
  min-width: 3.5rem;
}

.all-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 0.85rem;
}

.diagram-card {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow);
  padding: 0.7rem;
  min-height: 290px;
}

.card-title {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: baseline;
}

.card-title h2,
.single-title h2 {
  margin: 0;
  font-family: var(--font-head);
  font-size: 1.05rem;
}

.path {
  margin: 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.single-view {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 0.65rem;
}

.single-header {
  display: grid;
  gap: 0.45rem;
}

.viewer-frame {
  border: 1px solid var(--line);
  border-radius: 11px;
  background: #fff;
  overflow: hidden;
  min-height: 220px;
}

.diagram-card .viewer-frame {
  height: 260px;
}

.single-view .viewer-frame {
  height: 100%;
  min-height: 0;
}

.viewer-canvas {
  position: relative;
  height: 100%;
  min-height: 220px;
  touch-action: none;
  user-select: none;
  overflow: hidden;
  background:
    linear-gradient(45deg, #f9f8f4 25%, transparent 25%),
    linear-gradient(-45deg, #f9f8f4 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #f9f8f4 75%),
    linear-gradient(-45deg, transparent 75%, #f9f8f4 75%);
  background-size: 18px 18px;
  background-position:
    0 0,
    0 9px,
    9px -9px,
    -9px 0;
}

.viewer-canvas svg {
  width: 100%;
  height: 100%;
  display: block;
}

.state {
  color: var(--muted);
  margin: 0.55rem 0 0;
  font-size: 0.82rem;
}

.single-header .state {
  margin-top: 0;
}

.state.error {
  color: var(--error);
}

.state.empty {
  border: 1px dashed var(--line);
  border-radius: 10px;
  padding: 1rem;
  color: var(--muted);
  background: var(--surface);
}

@media (max-width: 960px) {
  .app-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .sidebar {
    border-right: none;
    border-bottom: 1px solid var(--line);
    max-height: 42dvh;
  }

  .all-grid {
    grid-template-columns: 1fr;
  }
}
`;

export const viewerJs = String.raw`(function () {
  var LIST_ETAG = "";
  var FILTER_KEY = "mermaid-live.filter";
  var SCROLL_KEY = "mermaid-live.all-scroll";
  var diagramsById = new Map();
  var diagramIds = [];
  var cardObserver = null;
  var panZoomByHost = new WeakMap();
  var statusById = new Map();
  var svgEtagById = new Map();
  var svgMarkupById = new Map();
  var detailEtagById = new Map();
  var isConnected = false;

  var app = {
    nav: document.getElementById("diagram-nav"),
    main: document.getElementById("main-content"),
    count: document.getElementById("diagram-count"),
    indicator: document.getElementById("connection-indicator"),
    filter: document.getElementById("diagram-filter")
  };

  if (!app.nav || !app.main || !app.count || !app.indicator || !app.filter) {
    return;
  }

  app.filter.value = localStorage.getItem(FILTER_KEY) || "";

  app.filter.addEventListener("input", function () {
    localStorage.setItem(FILTER_KEY, app.filter.value.trim());
    renderSidebar();
    renderRoute();
  });

  app.main.addEventListener("scroll", function () {
    if (getRoute().mode === "all") {
      sessionStorage.setItem(SCROLL_KEY, String(app.main.scrollTop));
    }
  });

  window.addEventListener("popstate", function () {
    renderRoute();
    renderSidebar();
  });

  document.addEventListener("keydown", function (event) {
    if (getRoute().mode !== "single") {
      return;
    }
    var target = event.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
      return;
    }
    var host = app.main.querySelector("[data-panzoom-host='single']");
    if (!host) {
      return;
    }
    var panZoom = panZoomByHost.get(host);
    if (!panZoom) {
      return;
    }
    if (event.key === "f") {
      panZoom.fit();
    } else if (event.key === "r") {
      panZoom.reset();
    } else if (event.key === "+" || event.key === "=") {
      panZoom.zoomIn();
    } else if (event.key === "-" || event.key === "_") {
      panZoom.zoomOut();
    } else {
      return;
    }
    event.preventDefault();
  });

  function navigate(path) {
    if (window.location.pathname === path) {
      return;
    }
    history.pushState({}, "", path);
    renderRoute();
    renderSidebar();
  }

  function getRoute() {
    var match = /^\/diagram\/([^/]+)$/.exec(window.location.pathname);
    if (match) {
      return { mode: "single", id: decodeURIComponent(match[1]) };
    }
    return { mode: "all" };
  }

  function formatName(diagram) {
    if (!diagram || !diagram.sourcePath) {
      return "Diagram " + (diagram ? diagram.id.slice(0, 8) : "unknown");
    }
    var normalized = diagram.sourcePath.replace(/\\/g, "/");
    var parts = normalized.split("/");
    return parts[parts.length - 1] || normalized;
  }

  function updateConnection(online) {
    isConnected = online;
    app.indicator.className = "connection " + (online ? "online" : "offline");
    app.indicator.textContent = online ? "Connected" : "Disconnected (reconnecting...)";
  }

  async function fetchJson(url, etag) {
    var headers = {};
    if (etag) {
      headers["If-None-Match"] = etag;
    }
    var response = await fetch(url, { headers: headers });
    if (response.status === 304) {
      return { notModified: true, etag: response.headers.get("etag") || etag, body: null };
    }
    if (!response.ok) {
      throw new Error("HTTP " + response.status + " for " + url);
    }
    return {
      notModified: false,
      etag: response.headers.get("etag") || "",
      body: await response.json()
    };
  }

  async function fetchText(url, etag) {
    var headers = {};
    if (etag) {
      headers["If-None-Match"] = etag;
    }
    var response = await fetch(url, { headers: headers });
    if (response.status === 304) {
      return { notModified: true, etag: response.headers.get("etag") || etag, text: null };
    }
    if (!response.ok) {
      throw new Error("HTTP " + response.status + " for " + url);
    }
    return {
      notModified: false,
      etag: response.headers.get("etag") || "",
      text: await response.text()
    };
  }

  function mergeSummary(summary) {
    var existing = diagramsById.get(summary.id);
    var merged = Object.assign({}, existing || {}, summary);
    diagramsById.set(summary.id, merged);
    if (diagramIds.indexOf(summary.id) === -1) {
      diagramIds.push(summary.id);
    }
  }

  function removeDiagram(diagramId) {
    diagramsById.delete(diagramId);
    statusById.delete(diagramId);
    svgEtagById.delete(diagramId);
    svgMarkupById.delete(diagramId);
    detailEtagById.delete(diagramId);
    diagramIds = diagramIds.filter(function (id) {
      return id !== diagramId;
    });
  }

  function sortIds() {
    diagramIds.sort(function (a, b) {
      var aDiagram = diagramsById.get(a);
      var bDiagram = diagramsById.get(b);
      var aName = formatName(aDiagram).toLowerCase();
      var bName = formatName(bDiagram).toLowerCase();
      return aName.localeCompare(bName);
    });
  }

  function getFilteredIds() {
    var query = app.filter.value.trim().toLowerCase();
    if (!query) {
      return diagramIds.slice();
    }
    return diagramIds.filter(function (id) {
      var diagram = diagramsById.get(id);
      if (!diagram) {
        return false;
      }
      var name = formatName(diagram).toLowerCase();
      var path = (diagram.sourcePath || "").toLowerCase();
      return name.indexOf(query) !== -1 || path.indexOf(query) !== -1;
    });
  }

  function statusChipClass(status) {
    return status === "failed" ? "chip chip-failed" : "chip chip-ready";
  }

  function renderSidebar() {
    var route = getRoute();
    var filteredIds = getFilteredIds();
    app.count.textContent = filteredIds.length + " diagrams";
    app.nav.textContent = "";

    if (!diagramIds.length) {
      var empty = document.createElement("p");
      empty.className = "state";
      empty.textContent = "No diagrams yet. Add .mmd files to begin.";
      app.nav.appendChild(empty);
      return;
    }

    var allLink = document.createElement("a");
    allLink.href = "/";
    allLink.className = "diagram-link" + (route.mode === "all" ? " active" : "");
    allLink.innerHTML = "<span class='name'>All diagrams</span><span class='chip chip-ready'>view</span>";
    allLink.addEventListener("click", function (event) {
      event.preventDefault();
      navigate("/");
    });
    app.nav.appendChild(allLink);

    filteredIds.forEach(function (id) {
      var diagram = diagramsById.get(id);
      if (!diagram) {
        return;
      }
      var link = document.createElement("a");
      link.href = "/diagram/" + encodeURIComponent(id);
      link.className = "diagram-link" + (route.mode === "single" && route.id === id ? " active" : "");
      link.innerHTML =
        "<span class='name' title='" +
        (diagram.sourcePath || id) +
        "'>" +
        escapeHtml(formatName(diagram)) +
        "</span>" +
        "<span class='" +
        statusChipClass(diagram.status) +
        "'>" +
        escapeHtml(diagram.status || "ready") +
        "</span>";
      link.addEventListener("click", function (event) {
        event.preventDefault();
        navigate("/diagram/" + encodeURIComponent(id));
      });
      app.nav.appendChild(link);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clearObserver() {
    if (cardObserver) {
      cardObserver.disconnect();
      cardObserver = null;
    }
  }

  function attachCardObserver() {
    clearObserver();
    cardObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          var id = entry.target.getAttribute("data-card-id");
          if (!id) {
            return;
          }
          cardObserver.unobserve(entry.target);
          void ensureDiagramLoaded(id, true);
        });
      },
      { root: app.main, rootMargin: "400px 0px" }
    );

    app.main.querySelectorAll("[data-card-id]").forEach(function (element) {
      cardObserver.observe(element);
    });
  }

  function makeViewerControls(diagram, hostKey) {
    var toolbar = document.createElement("div");
    toolbar.className = "toolbar";

    var fitBtn = button("Fit", "btn", function () {
      var host = app.main.querySelector("[data-panzoom-host='" + hostKey + "']");
      var panZoom = host ? panZoomByHost.get(host) : null;
      if (panZoom) {
        panZoom.fit();
      }
    });
    var resetBtn = button("Reset", "btn", function () {
      var host = app.main.querySelector("[data-panzoom-host='" + hostKey + "']");
      var panZoom = host ? panZoomByHost.get(host) : null;
      if (panZoom) {
        panZoom.reset();
      }
    });
    var zoomOutBtn = button("-", "btn", function () {
      var host = app.main.querySelector("[data-panzoom-host='" + hostKey + "']");
      var panZoom = host ? panZoomByHost.get(host) : null;
      if (panZoom) {
        panZoom.zoomOut();
      }
    });
    var zoomInBtn = button("+", "btn", function () {
      var host = app.main.querySelector("[data-panzoom-host='" + hostKey + "']");
      var panZoom = host ? panZoomByHost.get(host) : null;
      if (panZoom) {
        panZoom.zoomIn();
      }
    });
    var zoomValue = document.createElement("span");
    zoomValue.className = "zoom-value";
    zoomValue.textContent = "100%";
    zoomValue.setAttribute("data-zoom-label", hostKey);

    var download = document.createElement("a");
    download.className = "btn btn-primary";
    download.textContent = "Download SVG";
    download.href = diagram.svgUrl;
    download.download = formatName(diagram).replace(/[^a-zA-Z0-9._-]/g, "-") + ".svg";

    toolbar.appendChild(fitBtn);
    toolbar.appendChild(resetBtn);
    toolbar.appendChild(zoomOutBtn);
    toolbar.appendChild(zoomInBtn);
    toolbar.appendChild(zoomValue);
    toolbar.appendChild(download);
    return toolbar;
  }

  function button(label, className, onClick) {
    var element = document.createElement("button");
    element.type = "button";
    element.className = className;
    element.textContent = label;
    element.addEventListener("click", onClick);
    return element;
  }

  function createCard(diagram) {
    var card = document.createElement("section");
    card.className = "diagram-card";
    card.setAttribute("data-card-id", diagram.id);

    var title = document.createElement("div");
    title.className = "card-title";
    title.innerHTML =
      "<h2>" +
      escapeHtml(formatName(diagram)) +
      "</h2><span class='" +
      statusChipClass(diagram.status) +
      "'>" +
      escapeHtml(diagram.status) +
      "</span>";

    var path = document.createElement("p");
    path.className = "path";
    path.textContent = diagram.sourcePath || diagram.id;

    var hostKey = "card-" + diagram.id;
    var toolbar = makeViewerControls(diagram, hostKey);
    var frame = document.createElement("div");
    frame.className = "viewer-frame";
    var canvas = document.createElement("div");
    canvas.className = "viewer-canvas";
    canvas.setAttribute("data-panzoom-host", hostKey);
    frame.appendChild(canvas);

    var state = document.createElement("p");
    state.className = "state";
    state.setAttribute("data-state-id", diagram.id);
    state.textContent = statusById.get(diagram.id) || "Waiting for viewport load...";

    card.appendChild(title);
    card.appendChild(path);
    card.appendChild(toolbar);
    card.appendChild(frame);
    card.appendChild(state);
    return card;
  }

  function renderAllView() {
    var filteredIds = getFilteredIds();
    clearObserver();
    app.main.classList.remove("single-route");
    app.main.textContent = "";
    app.main.scrollTop = 0;

    if (!filteredIds.length) {
      var empty = document.createElement("p");
      empty.className = "state empty";
      empty.textContent = "No diagrams match this filter.";
      app.main.appendChild(empty);
      return;
    }

    var grid = document.createElement("div");
    grid.className = "all-grid";
    filteredIds.forEach(function (id) {
      var diagram = diagramsById.get(id);
      if (diagram) {
        grid.appendChild(createCard(diagram));
      }
    });
    app.main.appendChild(grid);

    attachCardObserver();

    var saved = Number(sessionStorage.getItem(SCROLL_KEY) || "0");
    requestAnimationFrame(function () {
      app.main.scrollTop = saved > 0 ? saved : 0;
    });
  }

  function renderSingleView(id) {
    clearObserver();
    app.main.classList.add("single-route");
    app.main.textContent = "";
    app.main.scrollTop = 0;
    var diagram = diagramsById.get(id);
    if (!diagram) {
      var empty = document.createElement("p");
      empty.className = "state empty";
      empty.textContent = "Diagram not found. Return to all diagrams and select another file.";
      app.main.appendChild(empty);
      return;
    }

    var root = document.createElement("section");
    root.className = "single-view";

    var header = document.createElement("div");
    header.className = "single-header";

    var heading = document.createElement("div");
    heading.className = "single-title";
    heading.innerHTML =
      "<h2>" +
      escapeHtml(formatName(diagram)) +
      "</h2><p class='path'>" +
      escapeHtml(diagram.sourcePath || diagram.id) +
      "</p>";

    var hostKey = "single";
    var toolbar = makeViewerControls(diagram, hostKey);

    var frame = document.createElement("div");
    frame.className = "viewer-frame";
    var canvas = document.createElement("div");
    canvas.className = "viewer-canvas";
    canvas.setAttribute("data-panzoom-host", hostKey);
    frame.appendChild(canvas);

    var state = document.createElement("p");
    state.className = "state";
    state.setAttribute("data-state-id", diagram.id);
    state.textContent = statusById.get(diagram.id) || "Loading diagram...";

    header.appendChild(heading);
    header.appendChild(toolbar);
    header.appendChild(state);

    root.appendChild(header);
    root.appendChild(frame);
    app.main.appendChild(root);

    void ensureDiagramLoaded(diagram.id, true);
  }

  function renderRoute() {
    var route = getRoute();
    if (route.mode === "single" && route.id) {
      renderSingleView(route.id);
      return;
    }
    renderAllView();
  }

  async function ensureDiagramLoaded(id, withSvg) {
    var diagram = diagramsById.get(id);
    if (!diagram) {
      return;
    }

    if (!diagram.sourcePath || statusById.get(id) === "stale") {
      var shouldRerender = false;
      statusById.set(id, "Loading metadata...");
      updateStateText(id);
      try {
        var detail = await fetchJson("/api/diagrams/" + encodeURIComponent(id), detailEtagById.get(id));
        if (!detail.notModified && detail.body && detail.body.diagram) {
          detailEtagById.set(id, detail.etag || "");
          diagramsById.set(id, Object.assign({}, diagram, detail.body.diagram));
          shouldRerender = true;
        }
      } catch (error) {
        statusById.set(id, "Failed to load metadata.");
        updateStateText(id, true);
        return;
      }

      if (shouldRerender) {
        renderSidebar();
        renderRoute();
      }
    }

    if (!withSvg) {
      return;
    }

    diagram = diagramsById.get(id);
    if (!diagram) {
      return;
    }

    if (diagram.status === "failed") {
      statusById.set(id, diagram.lastError ? "Render failed: " + diagram.lastError : "Render failed.");
      updateStateText(id, true);
      return;
    }

    statusById.set(id, "Loading SVG...");
    updateStateText(id);
    try {
      var svg = await fetchText(diagram.svgUrl, svgEtagById.get(id));
      if (svg.notModified) {
        var cachedSvg = svgMarkupById.get(id);
        if (cachedSvg) {
          mountSvg(id, cachedSvg);
        } else {
          var freshSvg = await fetchText(diagram.svgUrl, "");
          if (!freshSvg.notModified && freshSvg.text) {
            svgMarkupById.set(id, freshSvg.text);
            svgEtagById.set(id, freshSvg.etag || "");
            mountSvg(id, freshSvg.text);
          }
        }
        statusById.set(id, "Up to date");
        updateStateText(id);
        return;
      }
      svgEtagById.set(id, svg.etag || "");
      svgMarkupById.set(id, svg.text || "");
      mountSvg(id, svg.text || "");
      statusById.set(id, "Updated " + new Date().toLocaleTimeString());
      updateStateText(id);
    } catch (error) {
      statusById.set(id, "Failed to load SVG.");
      updateStateText(id, true);
    }
  }

  function updateStateText(id, isError) {
    app.main.querySelectorAll("[data-state-id='" + id + "']").forEach(function (node) {
      node.textContent = statusById.get(id) || "";
      node.className = "state" + (isError ? " error" : "");
    });
  }

  function mountSvg(diagramId, svgMarkup) {
    var hostSelectors = ["card-" + diagramId, "single"];
    hostSelectors.forEach(function (hostKey) {
      var host = app.main.querySelector("[data-panzoom-host='" + hostKey + "']");
      if (!host) {
        return;
      }
      var label = app.main.querySelector("[data-zoom-label='" + hostKey + "']");
      var panZoom = panZoomByHost.get(host);
      if (!panZoom) {
        panZoom = createPanZoom(host, label);
        panZoomByHost.set(host, panZoom);
      }
      panZoom.setSvg(svgMarkup);
      panZoom.fit();
    });
  }

  function createPanZoom(host, zoomLabel) {
    var svgElement = null;
    var initialBox = null;
    var currentBox = null;
    var pointer = null;

    function parseBox(value) {
      if (!value) {
        return null;
      }
      var parts = value
        .trim()
        .split(/\s+/)
        .map(function (part) {
          return Number(part);
        });
      if (parts.length !== 4 || parts.some(function (part) { return Number.isNaN(part); })) {
        return null;
      }
      return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    }

    function updateLabel() {
      if (!zoomLabel || !initialBox || !currentBox) {
        return;
      }
      var ratio = initialBox.w / currentBox.w;
      zoomLabel.textContent = Math.round(ratio * 100) + "%";
    }

    function cloneBox(box) {
      return { x: box.x, y: box.y, w: box.w, h: box.h };
    }

    function padBox(box, paddingRatio) {
      var padX = box.w * paddingRatio;
      var padY = box.h * paddingRatio;
      return {
        x: box.x - padX,
        y: box.y - padY,
        w: box.w + padX * 2,
        h: box.h + padY * 2
      };
    }

    function fitBoxToHost(box) {
      var rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return cloneBox(box);
      }

      var hostRatio = rect.width / rect.height;
      var boxRatio = box.w / box.h;
      if (!Number.isFinite(hostRatio) || !Number.isFinite(boxRatio) || boxRatio <= 0) {
        return cloneBox(box);
      }

      if (boxRatio > hostRatio) {
        var targetHeight = box.w / hostRatio;
        var extraHeight = targetHeight - box.h;
        return {
          x: box.x,
          y: box.y - extraHeight / 2,
          w: box.w,
          h: targetHeight
        };
      }

      var targetWidth = box.h * hostRatio;
      var extraWidth = targetWidth - box.w;
      return {
        x: box.x - extraWidth / 2,
        y: box.y,
        w: targetWidth,
        h: box.h
      };
    }

    function measureContentBox(fallbackBox) {
      if (!svgElement) {
        return fallbackBox;
      }

      try {
        var bbox = svgElement.getBBox();
        if (bbox.width > 0 && bbox.height > 0) {
          return {
            x: bbox.x,
            y: bbox.y,
            w: bbox.width,
            h: bbox.height
          };
        }
      } catch (_error) {
      }

      try {
        var nodes = svgElement.querySelectorAll(
          "g, path, rect, circle, ellipse, polygon, polyline, line, text, foreignObject"
        );
        var minX = Number.POSITIVE_INFINITY;
        var minY = Number.POSITIVE_INFINITY;
        var maxX = Number.NEGATIVE_INFINITY;
        var maxY = Number.NEGATIVE_INFINITY;

        nodes.forEach(function (node) {
          if (typeof node.getBBox !== "function") {
            return;
          }
          try {
            var nodeBox = node.getBBox();
            if (!nodeBox || nodeBox.width <= 0 || nodeBox.height <= 0) {
              return;
            }
            minX = Math.min(minX, nodeBox.x);
            minY = Math.min(minY, nodeBox.y);
            maxX = Math.max(maxX, nodeBox.x + nodeBox.width);
            maxY = Math.max(maxY, nodeBox.y + nodeBox.height);
          } catch (_nodeError) {
          }
        });

        if (
          Number.isFinite(minX) &&
          Number.isFinite(minY) &&
          Number.isFinite(maxX) &&
          Number.isFinite(maxY) &&
          maxX > minX &&
          maxY > minY
        ) {
          return {
            x: minX,
            y: minY,
            w: maxX - minX,
            h: maxY - minY
          };
        }
      } catch (_unionError) {
      }

      return fallbackBox;
    }

    function apply() {
      if (!svgElement || !currentBox) {
        return;
      }
      svgElement.setAttribute("viewBox", [currentBox.x, currentBox.y, currentBox.w, currentBox.h].join(" "));
      updateLabel();
    }

    function clampWidth(width) {
      if (!initialBox) {
        return width;
      }
      var minWidth = initialBox.w / 8;
      var maxWidth = initialBox.w * 4;
      return Math.max(minWidth, Math.min(maxWidth, width));
    }

    function zoomAt(clientX, clientY, factor) {
      if (!svgElement || !currentBox || !initialBox) {
        return;
      }
      var rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      var px = (clientX - rect.left) / rect.width;
      var py = (clientY - rect.top) / rect.height;
      var focusX = currentBox.x + currentBox.w * px;
      var focusY = currentBox.y + currentBox.h * py;
      var nextWidth = clampWidth(currentBox.w / factor);
      var scale = nextWidth / currentBox.w;
      var nextHeight = currentBox.h * scale;

      currentBox = {
        x: focusX - (focusX - currentBox.x) * scale,
        y: focusY - (focusY - currentBox.y) * scale,
        w: nextWidth,
        h: nextHeight
      };
      apply();
    }

    function panBy(deltaX, deltaY) {
      if (!currentBox) {
        return;
      }
      var rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      currentBox = {
        x: currentBox.x - deltaX * (currentBox.w / rect.width),
        y: currentBox.y - deltaY * (currentBox.h / rect.height),
        w: currentBox.w,
        h: currentBox.h
      };
      apply();
    }

    host.addEventListener(
      "wheel",
      function (event) {
        event.preventDefault();
        var factor = event.deltaY < 0 ? 1.15 : 0.85;
        zoomAt(event.clientX, event.clientY, factor);
      },
      { passive: false }
    );

    host.addEventListener("pointerdown", function (event) {
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      host.setPointerCapture(event.pointerId);
    });

    host.addEventListener("pointermove", function (event) {
      if (!pointer || pointer.id !== event.pointerId) {
        return;
      }
      var dx = event.clientX - pointer.x;
      var dy = event.clientY - pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      panBy(dx, dy);
    });

    function clearPointer(event) {
      if (pointer && pointer.id === event.pointerId) {
        pointer = null;
      }
    }

    host.addEventListener("pointerup", clearPointer);
    host.addEventListener("pointercancel", clearPointer);

    return {
      setSvg: function (svgMarkup) {
        host.textContent = "";
        var parser = new DOMParser();
        var parsed = parser.parseFromString(svgMarkup, "image/svg+xml");
        var nextSvg = parsed.documentElement;
        if (!nextSvg || nextSvg.nodeName.toLowerCase() !== "svg") {
          throw new Error("Invalid SVG document");
        }
        svgElement = document.importNode(nextSvg, true);
        var explicitWidth = Number(svgElement.getAttribute("width"));
        var explicitHeight = Number(svgElement.getAttribute("height"));
        svgElement.removeAttribute("width");
        svgElement.removeAttribute("height");
        svgElement.style.removeProperty("max-width");
        svgElement.style.removeProperty("max-height");
        svgElement.style.width = "100%";
        svgElement.style.height = "100%";
        svgElement.style.display = "block";
        host.appendChild(svgElement);

        var box = parseBox(svgElement.getAttribute("viewBox"));
        if (!box) {
          var width = explicitWidth || 1000;
          var height = explicitHeight || 700;
          box = { x: 0, y: 0, w: width, h: height };
          svgElement.setAttribute("viewBox", [0, 0, width, height].join(" "));
        }

        var contentBox = measureContentBox(box);
        var paddedBox = padBox(contentBox, 0.04);
        var fittedBox = fitBoxToHost(paddedBox);

        initialBox = cloneBox(fittedBox);
        currentBox = cloneBox(fittedBox);
        apply();
      },
      fit: function () {
        if (!initialBox) {
          return;
        }
        currentBox = fitBoxToHost(initialBox);
        apply();
      },
      reset: function () {
        if (!initialBox) {
          return;
        }
        currentBox = cloneBox(initialBox);
        apply();
      },
      zoomIn: function () {
        var rect = host.getBoundingClientRect();
        zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.2);
      },
      zoomOut: function () {
        var rect = host.getBoundingClientRect();
        zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.8);
      }
    };
  }

  async function refreshList() {
    var result = await fetchJson("/api/diagrams", LIST_ETAG);
    if (result.notModified || !result.body) {
      return;
    }
    LIST_ETAG = result.etag || LIST_ETAG;

    var incomingIds = new Set();
    (result.body.diagrams || []).forEach(function (summary) {
      incomingIds.add(summary.id);
      mergeSummary(summary);
    });

    diagramIds.slice().forEach(function (id) {
      if (!incomingIds.has(id)) {
        removeDiagram(id);
      }
    });
    sortIds();
  }

  async function onRealtimeEvent(type, payload) {
    if (!payload || !payload.id) {
      return;
    }
    var existing = diagramsById.get(payload.id);

    if (type === "diagram.deleted") {
      removeDiagram(payload.id);
      renderSidebar();
      if (getRoute().mode === "single" && getRoute().id === payload.id) {
        navigate("/");
      } else {
        renderRoute();
      }
      return;
    }

    if (!existing) {
      mergeSummary({
        id: payload.id,
        version: payload.version,
        updatedAt: payload.updatedAt,
        status: payload.status === "failed" ? "failed" : "ready",
        svgUrl: "/api/diagrams/" + encodeURIComponent(payload.id) + "/svg"
      });
      sortIds();
      renderSidebar();
      renderRoute();
      statusById.set(payload.id, "stale");
      void ensureDiagramLoaded(payload.id, true);
      return;
    }

    if (existing.version === payload.version && existing.status === payload.status) {
      return;
    }

    mergeSummary({
      id: payload.id,
      version: payload.version,
      updatedAt: payload.updatedAt,
      status: payload.status === "failed" ? "failed" : "ready",
      svgUrl: existing.svgUrl
    });
    statusById.set(payload.id, "stale");
    detailEtagById.delete(payload.id);
    svgEtagById.delete(payload.id);
    svgMarkupById.delete(payload.id);

    renderSidebar();
    if (getRoute().mode === "single" && getRoute().id === payload.id) {
      renderRoute();
    }
    void ensureDiagramLoaded(payload.id, true);
  }

  function connectEvents() {
    var source = new EventSource("/api/events");
    source.onopen = function () {
      updateConnection(true);
    };
    source.onerror = function () {
      updateConnection(false);
    };

    ["diagram.created", "diagram.updated", "diagram.failed", "diagram.deleted"].forEach(function (eventType) {
      source.addEventListener(eventType, function (event) {
        try {
          var payload = JSON.parse(event.data);
          void onRealtimeEvent(eventType, payload);
        } catch (_error) {
          updateConnection(false);
        }
      });
    });
  }

  async function boot() {
    statusById.clear();
    try {
      await refreshList();
      renderSidebar();
      renderRoute();
      connectEvents();
      updateConnection(false);
    } catch (error) {
      app.main.textContent = "";
      var banner = document.createElement("p");
      banner.className = "state error";
      banner.textContent = "Failed to load diagram catalog. Check server logs and refresh.";
      app.main.appendChild(banner);
      updateConnection(false);
    }
  }

  void boot();
})();
`;
