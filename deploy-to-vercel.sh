#!/bin/bash

# Script to deploy the application to Vercel and set up a custom domain

echo "=== Deploying SellMySeats to Vercel ==="
echo

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

# Make sure we're logged in
vercel whoami || vercel login

# Build the application
echo "Building the application..."
npm run build

# Deploy to Vercel
echo "Deploying to Vercel..."
vercel --prod

# Prompt for custom domain setup
echo
echo "Would you like to set up your custom domain now? (y/n)"
read -r setup_domain

if [[ $setup_domain == "y" || $setup_domain == "Y" ]]; then
    echo "Enter your custom domain (e.g., sellmyseats.rgnack.com):"
    read -r custom_domain
    
    vercel domains add $custom_domain
    
    echo
    echo "Domain added to Vercel project."
    echo "You will need to set up DNS records as instructed by Vercel."
    echo
    echo "For Cloudflare DNS, create a CNAME record:"
    echo "- Type: CNAME"
    echo "- Name: sellmyseats (or subdomain portion of your domain)"
    echo "- Target: cname.vercel-dns.com"
    echo "- Proxy status: DNS only (gray cloud)"
fi

echo
echo "=== Deployment Complete ==="
echo
echo "Your application should be available at your Vercel project URL."
echo "If you set up a custom domain, it will be available there once DNS propagates." 