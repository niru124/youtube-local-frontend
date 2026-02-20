#!/bin/bash

# youtube-local systemd service installer
# This script installs dependencies and creates a systemd user service for youtube-local

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" pwd)"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/youtube-local.service"

echo "=========================================="
echo "YouTube Local - Systemd Service Installer"
echo "=========================================="
echo ""

# Check if running on Arch Linux
if command -v pacman &> /dev/null; then
    echo "Detected Arch Linux (pacman)"
    echo ""
    
    # Install system dependencies
    echo "Installing system dependencies with pacman..."
    sudo pacman -S --needed python python-pip python-virtualenv libtor
    
    # Install Python packages using pip
    echo "Installing Python packages..."
    pip install --user flask gevent requests pyyaml urllib3 PySocks stem beautifulsoup4 lxml html5lib cachetools defusedxml
    
    echo "Dependencies installed successfully!"
    echo ""
else
    echo "Not an Arch Linux system. Please install dependencies manually:"
    echo "  - python3"
    echo "  - python-pip"
    echo "  - python-flask"
    echo "  - python-gevent"
    echo "  - python-requests"
    echo "  - python-pyyaml"
    echo "  - python-urllib3"
    echo "  - python-pysocks"
    echo "  - stem"
    echo "  - beautifulsoup4"
    echo "  - lxml"
    echo "  - html5lib"
    echo "  - cachetools"
    echo "  - defusedxml"
    echo ""
fi

# Create systemd user service directory if it doesn't exist
mkdir -p "$SERVICE_DIR"

# Detect python executable
PYTHON_BIN=$(command -v python3)

# Create the service file
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=YouTube Local - Self-hosted YouTube frontend
After=network.target

[Service]
Type=simple
WorkingDirectory=$SCRIPT_DIR
ExecStart=$PYTHON_BIN $SCRIPT_DIR/server.py
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF

echo "Service file created at: $SERVICE_FILE"
echo ""

# Reload systemd daemon
echo "Reloading systemd user daemon..."
systemctl --user daemon-reload

# Enable the service
echo "Enabling youtube-local service..."
systemctl --user enable youtube-local.service

echo ""
echo "=========================================="
echo "Installation complete!"
echo "=========================================="
echo ""
echo "To start the service:"
echo "  systemctl --user start youtube-local"
echo ""
echo "To stop the service:"
echo "  systemctl --user stop youtube-local"
echo ""
echo "To restart the service:"
echo "  systemctl --user restart youtube-local"
echo ""
echo "To check status:"
echo "  systemctl --user status youtube-local"
echo ""
echo "To view logs:"
echo "  journalctl --user -u youtube-local -f"
echo ""
echo "The service will start automatically on login."
