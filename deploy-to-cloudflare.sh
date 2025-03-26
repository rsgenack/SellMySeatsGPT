#!/bin/bash

# Script to deploy SellMySeats application to Cloudflare Pages

echo "=== SellMySeats Cloudflare Deployment ==="
echo "This script will help you deploy the application to Cloudflare Pages"
echo

# Check if Wrangler CLI is installed
if ! command -v wrangler &> /dev/null; then
  echo "Installing Wrangler CLI..."
  npm install -g wrangler
fi

# Build the application
echo "Building the application..."
npm run build

# Check if build succeeded
if [ $? -ne 0 ]; then
  echo "Build failed. Please fix the errors and try again."
  exit 1
fi

# Create Cloudflare Worker bundle
echo "Preparing Cloudflare Worker bundle..."
mkdir -p worker-dist
cp -r dist/* worker-dist/
cp worker.js worker-dist/

# Set up environment variables in Cloudflare
echo "Setting up environment variables..."
echo "You will need to add your sensitive environment variables in the Cloudflare dashboard"
echo "after deployment."

# Log in to Cloudflare if not already logged in
echo "Checking Cloudflare authentication..."
wrangler whoami || wrangler login

# Deploy to Cloudflare
echo "Deploying to Cloudflare..."
wrangler deploy

echo 
echo "=== Deployment Complete ==="
echo
echo "Next steps:"
echo "1. Go to your Cloudflare dashboard at https://dash.cloudflare.com"
echo "2. Navigate to your Workers & Pages section"
echo "3. Find your 'sellmyseats-rgnack' project"
echo "4. Add your environment variables in the Settings > Environment Variables section"
echo "5. Set up your custom domain 'sellmyseats.rgnack.com' in the Custom Domains section"
echo
echo "Your application will be available at: https://sellmyseats.rgnack.com" 