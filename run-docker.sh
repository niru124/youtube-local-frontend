#!/bin/bash
set -e

CONTAINER_NAME="youtube-local"

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Container '$CONTAINER_NAME' already exists. Starting..."
    docker start "$CONTAINER_NAME"
else
    echo "Building Docker image..."
    docker build -t youtube-local .
    
    echo "Creating and starting container..."
    docker run -d -p 8080:8080 --name "$CONTAINER_NAME" youtube-local
fi
