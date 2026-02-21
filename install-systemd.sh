#!/bin/bash

# youtube-local systemd service installer
# This script installs dependencies, copies files to /opt/youtube-local, and creates a systemd user service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="/opt/youtube-local"
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
    sudo pacman -S --needed python python-pip python-virtualenv tor python-flask python-gevent python-requests python-pyyaml python-urllib3 python-socks python-stem python-cachetools python-defusedxml
    
    echo "Dependencies installed successfully!"
    echo ""
else
    echo "Not an Arch Linux system. Please install dependencies manually:"
    echo "  - python3"
    echo "  - python-flask"
    echo "  - python-gevent"
    echo "  - python-requests"
    echo "  - python-pyyaml"
    echo "  - python-urllib3"
    echo "  - python-socks"
    echo "  - python-stem"
    echo "  - python-cachetools"
    echo "  - python-defusedxml"
    echo ""
fi

# Create target directory
echo "Creating target directory: $TARGET_DIR"
sudo mkdir -p "$TARGET_DIR"

# Copy files to target directory
echo "Copying files to $TARGET_DIR..."
sudo cp "$SCRIPT_DIR/server.py" "$TARGET_DIR/"
sudo cp "$SCRIPT_DIR/settings.py" "$TARGET_DIR/"

# Copy youtube directory
if [ -d "$TARGET_DIR/youtube" ]; then
    echo "Updating youtube directory..."
    sudo rm -rf "$TARGET_DIR/youtube"
fi
sudo cp -r "$SCRIPT_DIR/youtube" "$TARGET_DIR/"

# Set permissions
sudo chown -R $USER:$USER "$TARGET_DIR"

echo "Files copied successfully!"
echo ""

# Create systemd user service directory if it doesn't exist
mkdir -p "$SERVICE_DIR"

# Create the service file
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=YouTube Local - Self-hosted YouTube frontend
After=network.target

[Service]
Type=simple
WorkingDirectory=$TARGET_DIR
ExecStart=/usr/bin/python3 $TARGET_DIR/server.py
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
echo "Files installed to: $TARGET_DIR"
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
