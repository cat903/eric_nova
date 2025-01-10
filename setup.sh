#!/bin/bash

# Prompt user for hostname
read -p "Please enter your hostname (e.g., example.com): " HOSTNAME

# Clone the GitHub repository
echo "Cloning repository..."
git clone https://github.com/cat903/eric_nova.git

# Changing Directory to the GitHub repository
cd eric_nova

# Prompt user for credentials
read -r -p "Please enter your username: " USERNAME
read -r -sp "Please enter your password: " PASSWORD
echo ""

# Create .env file with provided credentials
echo "Creating .env file..."
{
  echo "USERE=$USERNAME"
  echo "USERP=$PASSWORD"
} > .env

# Step 1: Download and install nvm
echo "Downloading and installing nvm..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Load nvm into the current shell session
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Step 2: Download and install Node.js
echo "Installing Node.js..."
nvm install 22

# Step 3: Verify Node.js version
echo "Verifying Node.js installation..."
node -v
nvm current

# Step 4: Verify npm version
echo "Verifying npm installation..."
npm -v

# Step 5: Retrieve the latest package lists
echo "Updating package lists..."
sudo apt update

# Step 6: Install Nginx
echo "Installing Nginx..."
sudo apt install nginx -y

# Step 7: Install CertBot
echo "Installing CertBot..."
sudo apt install certbot python3-certbot-nginx -y

# Step 8: Install PM2 globally using npm
echo "Installing PM2 globally..."
npm install pm2 -g

# Step 9: Install project dependencies and start with PM2
echo "Installing project dependencies..."
npm install --save
echo "Starting application with PM2..."
pm2 start ecosystem.config.js

# Step 10: Issue SSL Certificate
echo "Issuing SSL certificate for $HOSTNAME..."
sudo certbot --nginx -d "$HOSTNAME"

# Step 11: Configure Nginx to use proxy pass at port 3000
echo "Configuring Nginx to use proxy pass at port 3000..."
NGINX_CONF="/etc/nginx/sites-available/default"
sudo sed -i "$(awk '/location \/ {/ {n++} n==3 {print NR; exit}' $NGINX_CONF)s|location / {[^}]*|location / {\n    proxy_pass http://localhost:3000;\n    proxy_http_version 1.1;\n    proxy_set_header Upgrade \$http_upgrade;\n    proxy_set_header Connection \"upgrade\";\n    proxy_set_header Host \$host;\n    proxy_set_header X-Real-IP \$remote_addr;\n    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n    proxy_cache_bypass \$http_upgrade;|" $NGINX_CONF


# Restart Nginx to apply the changes
echo "Restarting Nginx..."
sudo systemctl restart nginx

# Completion message
echo "Setup completed! Node.js, PM2, Nginx, and SSL certificate have been installed and configured."