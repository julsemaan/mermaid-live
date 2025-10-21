#!/bin/bash
# mermaid-live.sh

# Default values
PORT=18000
INPUT_DIR="."

if [ -z "$OUT_DIR" ]; then
  OUT_DIR="$(mktemp -d mermaid-live-out.XXXXXX)"
fi

echo "Output directory: $OUT_DIR"

PUPPETEER_CONFIG_PATH=$(mktemp /tmp/puppeteer_config.XXXXXX.json)

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--port)
            PORT="$2"
            shift
            shift
            ;;
        -i|--input)
            INPUT_DIR="$2"
            shift
            shift
            ;;
        -o|--output)
            OUT_DIR="$2"
            shift
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -p, --port PORT      Port to run the server on (default: 18000)"
            echo "  -i, --input DIR      Input directory with mermaid files (default: current directory)"
            echo "  -o, --output DIR     Output directory for generated SVGs (default: outs)"
            echo "  -h, --help           Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Create directories and config
mkdir -p "$OUT_DIR"
cat > $PUPPETEER_CONFIG_PATH << 'EOF'
{
  "args": ["--no-sandbox", "--disable-setuid-sandbox"]
}
EOF

# Function to generate HTML with zoom controls and refresh toggle
generate_index() {
    cat > "$OUT_DIR/index.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Mermaid Live Preview with Zoom</title>
    <link rel="icon" type="image/x-icon" href="https://mermaid.js.org/favicon.ico">
    <link rel="icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAwnpUWHRSYXcgcHJvZmlsZSB0eXBlIGV4aWYAAHjabVDbEcMgDPv3FB0BPyD2OKRJ77pBx68BJw1tdYdiJJ9iDPvr+YBbA6GA5EWLlZIcYmJUvdA0UDtjks4dHJbfJx1Og1ziT6eW6D90PAPGp3qVL0F6D2OdDZPI168gisnaRK3eIsgiiGkYGAF1PCsV0+X6hHVPM3QcaCQ6j/1zX3x7W/b/MNHOyMmZWccA3E4Grl6YM3L2RmTpCnblmMQX8m9PB+AN3SJZEakT1y8AAAGEaUNDUElDQyBwcm9maWxlAAB4nH2RPUjDQBzFX1PFDypF7FDEIUPVxS4q4lirUIQKoVZo1cHk0i9o0pCkuDgKrgUHPxarDi7Oujq4CoLgB4i74KToIiX+Lym0iPXguB/v7j3u3gFCvcw0qysGaLptphJxMZNdFXte0YcgBjGOsMwsY06Skug4vu7h4+tdlGd1PvfnGFBzFgN8InGMGaZNvEE8s2kbnPeJQ6woq8TnxBMmXZD4keuKx2+cCy4LPDNkplPzxCFisdDGShuzoqkRTxNHVE2nfCHjscp5i7NWrrLmPfkLAzl9ZZnrNEeQwCKWIEGEgipKKMNGlFadFAsp2o938A+7folcCrlKYORYQAUaZNcP/ge/u7XyU5NeUiAOdL84zsco0LMLNGqO833sOI0TwP8MXOktf6UOzH6SXmtpkSMguA1cXLc0ZQ+43AHCT4Zsyq7kpynk88D7GX1TFhi6BfrXvN6a+zh9ANLUVfIGODgExgqUvd7h3b3tvf17ptnfD6Qucro8wzS9AAAPomlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNC40LjAtRXhpdjIiPgogPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIgogICAgeG1sbnM6R0lNUD0iaHR0cDovL3d3dy5naW1wLm9yZy94bXAvIgogICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iCiAgICB4bWxuczppcHRjRXh0PSJodHRwOi8vaXB0Yy5vcmcvc3RkL0lwdGM0eG1wRXh0LzIwMDgtMDItMjkvIgogICAgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIgogICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iCiAgIHhtcE1NOkRvY3VtZW50SUQ9ImdpbXA6ZG9jaWQ6Z2ltcDo4ODkzYmRiMC1kMGI0LTQ5ODItYTAyOS04YjAwNjc3OTY3YjYiCiAgIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OTcxZjdiNTUtMTAyOC00MmE5LWExZmMtMDg4YjRjNTU4YWI2IgogICB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6MjQ2ZDM4YzMtOTRiZS00YzhmLTkyZGYtZDM4YTA3MzI0ODIyIgogICBHSU1QOkFQST0iMi4wIgogICBHSU1QOlBsYXRmb3JtPSJNYWMgT1MiCiAgIEdJTVA6VGltZVN0YW1wPSIxNzU3OTU5Mjc0ODE2MjM4IgogICBHSU1QOlZlcnNpb249IjIuMTAuMzgiCiAgIGRjOkZvcm1hdD0iaW1hZ2UvcG5nIgogICBleGlmOkRhdGVUaW1lT3JpZ2luYWw9IjIwMjUtMDktMTVUMTc6NDY6NTIrMDA6MDAiCiAgIGlwdGNFeHQ6RGlnaXRhbFNvdXJjZUZpbGVUeXBlPSJodHRwOi8vY3YuaXB0Yy5vcmcvbmV3c2NvZGVzL2RpZ2l0YWxzb3VyY2V0eXBlL2NvbXBvc2l0ZVdpdGhUcmFpbmVkQWxnb3JpdGhtaWNNZWRpYSIKICAgaXB0Y0V4dDpEaWdpdGFsU291cmNlVHlwZT0iaHR0cDovL2N2LmlwdGMub3JnL25ld3Njb2Rlcy9kaWdpdGFsc291cmNldHlwZS9jb21wb3NpdGVXaXRoVHJhaW5lZEFsZ29yaXRobWljTWVkaWEiCiAgIHBob3Rvc2hvcDpDcmVkaXQ9IkVkaXRlZCB3aXRoIEdvb2dsZSBBSSIKICAgcGhvdG9zaG9wOkRhdGVDcmVhdGVkPSIyMDI1LTA5LTE1VDE3OjQ2OjUyKzAwOjAwIgogICB0aWZmOk9yaWVudGF0aW9uPSIxIgogICB4bXA6Q3JlYXRvclRvb2w9IkdJTVAgMi4xMCIKICAgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyNTowOToxNVQxNDowMToxNC0wNDowMCIKICAgeG1wOk1vZGlmeURhdGU9IjIwMjU6MDk6MTVUMTQ6MDE6MTQtMDQ6MDAiPgogICA8eG1wTU06SGlzdG9yeT4KICAgIDxyZGY6U2VxPgogICAgIDxyZGY6bGkKICAgICAgc3RFdnQ6YWN0aW9uPSJzYXZlZCIKICAgICAgc3RFdnQ6Y2hhbmdlZD0iLyIKICAgICAgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo2MjcyY2FhOS05NWViLTQ2Y2EtYWMzZC1kMWExN2ExMjdiNmMiCiAgICAgIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkdpbXAgMi4xMCAoTWFjIE9TKSIKICAgICAgc3RFdnQ6d2hlbj0iMjAyNS0wOS0xNVQxNDowMToxNC0wNDowMCIvPgogICAgPC9yZGY6U2VxPgogICA8L3htcE1NOkhpc3Rvcnk+CiAgPC9yZGY6RGVzY3JpcHRpb24+CiA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg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" type="image/png">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            background: #f5f5f5;
        }
        .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .global-controls {
            background: #e9ecef;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }
        .control-group {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .diagram-container {
            background: white;
            margin: 20px 0;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: auto;
        }
        .controls {
            margin: 10px 0;
            padding: 10px;
            background: #f0f0f0;
            border-radius: 4px;
        }
        .zoom-controls {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 10px;
        }
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            background: #007bff;
            color: white;
            cursor: pointer;
            font-size: 14px;
        }
        button:hover {
            background: #0056b3;
        }
        button.secondary {
            background: #6c757d;
        }
        button.secondary:hover {
            background: #545b62;
        }
        button.success {
            background: #28a745;
        }
        button.success:hover {
            background: #218838;
        }
        button.danger {
            background: #dc3545;
        }
        button.danger:hover {
            background: #c82333;
        }
        .zoom-level {
            font-weight: bold;
            min-width: 60px;
        }
        .diagram-wrapper {
            overflow: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            background: white;
            max-height: 70vh;
        }
        .diagram-image {
            display: block;
            transition: transform 0.2s ease;
            transform-origin: 0 0;
        }
        h2 { 
            color: #333; 
            margin-top: 0;
            margin-bottom: 15px;
        }
        .timestamp {
            color: 666;
            font-size: 12px;
            margin-top: 10px;
        }
        .refresh-status {
            padding: 5px 10px;
            border-radius: 4px;
            font-weight: bold;
        }
        .refresh-on {
            background: #d4edda;
            color: #155724;
        }
        .refresh-off {
            background: #f8d7da;
            color: #721c24;
        }
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 5px;
        }
        .status-on {
            background: #28a745;
        }
        .status-off {
            background: #dc3545;
        }
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            opacity: 1;
            transition: opacity 0.5s;
        }
        .countdown {
            font-weight: bold;
            margin-left: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Mermaid Diagrams Live Preview</h1>
        <p>Port: $PORT - Use mouse wheel to zoom - Drag to pan</p>
    </div>
    
    <div class="global-controls">
        <div class="control-group">
            <span>Auto Refresh:</span>
            <span class="refresh-status refresh-on" id="refresh-status">
                <span class="status-indicator status-on"></span>ENABLED <!-- (<span id="countdown">X</span>s)-->
            </span>
            <button onclick="toggleAutoRefresh()" class="danger" id="toggle-refresh-btn">
                Disable Auto-Refresh
            </button>
        </div>
        <div class="control-group">
            <button onclick="refreshPage()" class="success">
                Refresh Now
            </button>
            <button onclick="refreshImages()" class="secondary">
                Reload Images Only
            </button>
        </div>
        <div class="control-group">
            <span>Server Port: $PORT</span>
        </div>
    </div>
    
    $(for file in "$OUT_DIR"/*.svg; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            diagram_name="${filename%.svg}"
            echo "<div class='diagram-container'>"
            echo "<h2>${diagram_name}</h2>"
            echo "<div class='controls'>"
            echo "<div class='zoom-controls'>"
            echo "<button onclick='zoomOut(\"${diagram_name}\")'>Zoom Out</button>"
            echo "<span class='zoom-level' id='zoom-level-${diagram_name}'>100%</span>"
            echo "<button onclick='zoomIn(\"${diagram_name}\")'>Zoom In</button>"
            echo "<button onclick='resetZoom(\"${diagram_name}\")'>Reset</button>"
            echo "<button onclick='downloadSVG(\"${filename}\")'>Download SVG</button>"
            echo "</div>"
            echo "</div>"
            echo "<div class='diagram-wrapper' id='wrapper-${diagram_name}'>"
            echo "<img src='${filename}?t=$(date +%s)' alt='${diagram_name} diagram' class='diagram-image' id='img-${diagram_name}' style='transform: scale(1);'>"
            echo "</div>"
            echo "<div class='timestamp'>Last updated: $(date)</div>"
            echo "</div>"
        fi
    done)
    
    <script>
        const zoomLevels = {};
        const isDragging = {};
        const startPos = {};
        let autoRefreshEnabled = true;
        const refreshInterval = 1; // seconds
        let refreshTimer = null;
        let countdownTimer = null;
        let countdownValue = refreshInterval;
        
        // Initialize
        function init() {
            setupZoomAndDrag();
            startAutoRefresh();
            setupKeyboardShortcuts();
        }
        
        // Setup zoom and drag functionality
        function setupZoomAndDrag() {
            document.querySelectorAll('.diagram-image').forEach(img => {
                const id = img.id.replace('img-', '');
                zoomLevels[id] = 1;
                
                // Enable mouse wheel zoom
                img.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? -0.1 : 0.1;
                    updateZoom(id, zoomLevels[id] + delta);
                });
                
                // Enable drag to pan
                img.addEventListener('mousedown', (e) => {
                    isDragging[id] = true;
                    startPos[id] = { x: e.clientX, y: e.clientY };
                    img.style.cursor = 'grabbing';
                });
                
                img.style.cursor = 'grab';
            });
            
            document.addEventListener('mousemove', (e) => {
                for (const id in isDragging) {
                    if (isDragging[id]) {
                        const dx = e.clientX - startPos[id].x;
                        const dy = e.clientY - startPos[id].y;
                        startPos[id] = { x: e.clientX, y: e.clientY };
                        
                        const wrapper = document.getElementById('wrapper-' + id);
                        wrapper.scrollLeft -= dx;
                        wrapper.scrollTop -= dy;
                    }
                }
            });
            
            document.addEventListener('mouseup', () => {
                for (const id in isDragging) {
                    if (isDragging[id]) {
                        isDragging[id] = false;
                        const img = document.getElementById('img-' + id);
                        if (img) img.style.cursor = 'grab';
                    }
                }
            });
        }
        
        // Start auto-refresh
        function startAutoRefresh() {
            if (refreshTimer) {
                clearInterval(refreshTimer);
                refreshTimer = null;
            }
            
            if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
            
            if (autoRefreshEnabled) {
                countdownValue = refreshInterval;
                updateCountdown();
                
                countdownTimer = setInterval(() => {
                    countdownValue--;
                    updateCountdown();
                    
                    if (countdownValue <= 0) {
                        countdownValue = refreshInterval;
                        refreshImages();
                    }
                }, 1000);
                
                refreshTimer = setInterval(refreshImages, refreshInterval * 1000);
            }
        }
        
        // Update countdown display
        function updateCountdown() {
            const countdownElement = document.getElementById('countdown');
            if (countdownElement) {
                countdownElement.textContent = countdownValue;
            }
        }
        
        // Setup keyboard shortcuts
        function setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    const diagrams = Object.keys(zoomLevels);
                    
                    if (diagrams.length > 0) {
                        const currentDiagram = diagrams[0];
                        
                        if (e.key === '+') {
                            e.preventDefault();
                            zoomIn(currentDiagram);
                        } else if (e.key === '-') {
                            e.preventDefault();
                            zoomOut(currentDiagram);
                        } else if (e.key === '0') {
                            e.preventDefault();
                            resetZoom(currentDiagram);
                        } else if (e.key === 'r') {
                            e.preventDefault();
                            if (e.shiftKey) {
                                refreshImages();
                            } else {
                                refreshPage();
                            }
                        } else if (e.key === 'a') {
                            e.preventDefault();
                            toggleAutoRefresh();
                        }
                    }
                }
                
                // F5 for refresh page, Shift+F5 for refresh images
                if (e.key === 'F5') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        refreshImages();
                    } else {
                        refreshPage();
                    }
                }
            });
        }
        
        function updateZoom(id, newZoom) {
            newZoom = Math.max(0.1, Math.min(5, newZoom)); // Limit zoom between 10% and 500%
            zoomLevels[id] = newZoom;
            
            const img = document.getElementById('img-' + id);
            const zoomDisplay = document.getElementById('zoom-level-' + id);
            
            if (img && zoomDisplay) {
                img.style.transform = 'scale(' + newZoom + ')';
                zoomDisplay.textContent = Math.round(newZoom * 100) + '%';
            }
        }
        
        function zoomIn(id) {
            updateZoom(id, zoomLevels[id] + 0.1);
        }
        
        function zoomOut(id) {
            updateZoom(id, zoomLevels[id] - 0.1);
        }
        
        function resetZoom(id) {
            updateZoom(id, 1);
            const wrapper = document.getElementById('wrapper-' + id);
            if (wrapper) {
                wrapper.scrollLeft = 0;
                wrapper.scrollTop = 0;
            }
        }
        
        function downloadSVG(filename) {
            const link = document.createElement('a');
            link.href = filename + '?download=true&t=' + Date.now();
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        function toggleAutoRefresh() {
            autoRefreshEnabled = !autoRefreshEnabled;
            const statusElement = document.getElementById('refresh-status');
            const button = document.getElementById('toggle-refresh-btn');
            
            if (autoRefreshEnabled) {
                // Enable auto-refresh
                statusElement.className = 'refresh-status refresh-on';
                statusElement.innerHTML = '<span class="status-indicator status-on"></span>ENABLED (<span id="countdown">3</span>s)';
                button.textContent = 'Disable Auto-Refresh';
                button.className = 'danger';
                startAutoRefresh();
            } else {
                // Disable auto-refresh
                statusElement.className = 'refresh-status refresh-off';
                statusElement.innerHTML = '<span class="status-indicator status-off"></span>DISABLED';
                button.textContent = 'Enable Auto-Refresh';
                button.className = 'success';
                
                // Clear timers
                if (refreshTimer) {
                    clearInterval(refreshTimer);
                    refreshTimer = null;
                }
                if (countdownTimer) {
                    clearInterval(countdownTimer);
                    countdownTimer = null;
                }
                
                // Update countdown display
                const countdownElement = document.getElementById('countdown');
                if (countdownElement) {
                    countdownElement.textContent = '-';
                }
            }
        }
        
        function refreshPage() {
            window.location.reload();
        }
        
        function refreshImages() {
            // Reload only the images without refreshing the whole page
            document.querySelectorAll('.diagram-image').forEach(img => {
                const src = img.src.split('?')[0]; // Remove existing timestamp
                img.src = src + '?t=' + Date.now(); // Add new timestamp
            });
            
            // Update timestamps
            document.querySelectorAll('.timestamp').forEach(el => {
                el.textContent = 'Last updated: ' + new Date().toLocaleString();
            });
            
            // Reset countdown
            if (autoRefreshEnabled) {
                countdownValue = refreshInterval;
                updateCountdown();
            }
            
            // Show a quick notification
            // showNotification('Images reloaded!');
        }
        
        function showNotification(message) {
            // Remove any existing notification
            const existingNotification = document.querySelector('.notification');
            if (existingNotification) {
                existingNotification.remove();
            }
            
            // Create notification element
            const notification = document.createElement('div');
            notification.textContent = message;
            notification.className = 'notification';
            
            document.body.appendChild(notification);
            
            // Remove after 2 seconds
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 500);
            }, 2000);
        }
        
        // Initialize when page loads
        window.addEventListener('load', init);
    </script>
</body>
</html>
EOF
}

# Function to process a single file
process_file() {
    local file="$1"
    local basefile=$(basename "$file")
    local output_file="$OUT_DIR/${basefile%.*}.svg"
    local current_mtime=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file")
    local last_mtime=$(cat "$OUT_DIR/.${basefile}.mtime" 2>/dev/null || echo 0)
    
    if [ "$current_mtime" -gt "$last_mtime" ]; then
        echo "Converting $file..."
        mmdc -i "$file" -o "$output_file" --puppeteerConfigFile $PUPPETEER_CONFIG_PATH
        if [ $? -eq 0 ]; then
            echo "$current_mtime" > "$OUT_DIR/.${basefile}.mtime"
        fi
    fi
}

# Initial processing of all files
process_all_files() {
    echo "Processing mermaid files in $INPUT_DIR..."
    for ext in mermaid mmd; do
        for file in "$INPUT_DIR"/*.$ext; do
            if [ -f "$file" ]; then
                process_file "$file"
            fi
        done
    done
    generate_index
}

# Set up cleanup function
cleanup() {
    echo -e "\nShutting down..."
    # Kill only the specific processes we started
    if [ -n "$WATCHER_PID" ]; then
        kill "$WATCHER_PID" 2>/dev/null || true
    fi
    
    if [ -n "$SERVER_PID" ]; then
        kill "$SERVER_PID" 2>/dev/null || true
    fi
    
    # Kill processes using the port (more targeted approach)
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    fi
    
    # Remove config file
    rm -f $PUPPETEER_CONFIG_PATH
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Initial processing
process_all_files

# Start file watcher in background
if command -v inotifywait >/dev/null 2>&1; then
    echo "Watching for file changes in $INPUT_DIR with inotifywait..."
    (
        while true; do
            inotifywait -e close_write -e moved_to -e create -q -r "$INPUT_DIR" --include '\.(mermaid|mmd)$'
            for ext in mermaid mmd; do
                for file in "$INPUT_DIR"/*.$ext; do
                    if [ -f "$file" ]; then
                        process_file "$file"
                    fi
                done
            done
            generate_index
        done
    ) &
else
    echo "inotifywait not found, falling back to polling every 2 seconds..."
    (
        while true; do
            process_all_files
            sleep 2
        done
    ) &
fi

# Store the PID of the file watcher
WATCHER_PID=$!

# Start web server
echo "Starting web server on http://localhost:$PORT"
echo "Open http://localhost:$PORT in your browser"
echo "Press Ctrl+C to stop"

# Start Python server and capture its PID
python3 -m http.server $PORT --directory "$OUT_DIR" &
SERVER_PID=$!

# Wait for both processes
wait $WATCHER_PID $SERVER_PID
