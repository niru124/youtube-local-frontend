#!/bin/bash

# youtube-local uninstaller
# This script removes youtube-local from /opt/youtube-local and disables the systemd service

set -e

TARGET_DIR="/opt/youtube-local"
SERVICE_FILE="$HOME/.config/systemd/user/youtube-local.service"

echo "=========================================="
echo "YouTube Local - Uninstaller"
echo "=========================================="
echo ""

# Stop and disable the service
echo "Stopping and disabling systemd service..."
systemctl --user stop youtube-local 2>/dev/null || true
systemctl --user disable youtube-local 2>/dev/null || true
systemctl --user daemon-reload 2>/dev/null || true

# Remove service file
if [ -f "$SERVICE_FILE" ]; then
    echo "Removing service file..."
    rm -f "$SERVICE_FILE"
fi

# Remove target directory
if [ -d "$TARGET_DIR" ]; then
    echo "Removing $TARGET_DIR..."
    sudo rm -rf "$TARGET_DIR"
fi

echo ""
echo "=========================================="
echo "Uninstallation complete!"
echo "=========================================="
echo ""
echo "Note: Python packages installed via pacman were not removed."
echo "To remove them, run:"
echo "  sudo pacman -R python-flask python-gevent python-requests python-pyyaml python-urllib3 python-socks python-stem python-cachetools python-defusedxml"
