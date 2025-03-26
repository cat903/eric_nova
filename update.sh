#!/bin/bash

cd ~

# Backup existing .env file if it exists
if [ -f "eric_nova/.env" ]; then
    echo "Backing up existing .env file..."
    cp eric_nova/.env .env.bak
fi

# Remove existing folder
rm -rf eric_nova

# Clone fresh repository
git clone https://github.com/cat903/eric_nova.git
cd eric_nova

# Restore .env file from backup if it exists
if [ -f "../.env.bak" ]; then
    echo "Restoring .env file to new repository..."
    mv ../.env.bak .env
fi

# Load nvm into the current shell session
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

echo "Installing PM2 globally..."
npm install pm2 -g

echo "Installing project dependencies..."
npm install --save

echo "Updating PM2..."
pm2 update

echo "Starting application with PM2..."
pm2 start ecosystem.config.js

clear
