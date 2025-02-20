#!/bin/bash

# Remove existing folder
rm -rf eric_nova

# Clone fresh
git clone https://github.com/cat903/eric_nova.git
cd eric_nova

echo "Installing PM2 globally..."
npm install pm2 -g

echo "Installing project dependencies..."
npm install --save

echo "Starting application with PM2..."
pm2 start ecosystem.config.js
