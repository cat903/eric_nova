#!/bin/bash

# Clone the GitHub repository
echo "Cloning repository..."
git clone https://github.com/cat903/eric_nova.git

# Changing Directory to the GitHub repository
cd eric_nova

# Install project dependencies and start with PM2
echo "Installing project dependencies..."
npm install --save
echo "Starting application with PM2..."
pm2 start ecosystem.config.js
