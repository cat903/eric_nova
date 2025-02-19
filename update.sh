#!/bin/bash

REPO_DIR="eric_nova"
REPO_URL="https://github.com/cat903/eric_nova.git"

if [ -d "$REPO_DIR" ]; then
    echo "Directory '$REPO_DIR' already exists. Updating repository..."
    cd "$REPO_DIR" || exit
    git pull
else
    echo "Cloning repository..."
    git clone "$REPO_URL"
    cd "$REPO_DIR" || exit
fi

echo "Installing project dependencies..."
npm install --save

echo "Starting application with PM2..."
pm2 start ecosystem.config.js
