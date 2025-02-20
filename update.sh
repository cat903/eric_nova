#!/bin/bash

# Remove existing folder
rm -rf eric_nova

# Clone fresh
git clone https://github.com/cat903/eric_nova.git
cd eric_nova

# Load nvm into the current shell session
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

echo "Installing PM2 globally..."
npm install pm2 -g

echo "Installing project dependencies..."
npm install --save

echo "Starting application with PM2..."
pm2 start ecosystem.config.js
