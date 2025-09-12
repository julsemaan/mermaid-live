#!/bin/bash
# mermaid-live.sh

# Default values
PORT=18000
INPUT_DIR="."
OUT_DIR="$(mktemp -d mermaid-live-out.XXXXXX)"

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
                <span class="status-indicator status-on"></span>ENABLED (<span id="countdown">X</span>s)
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
