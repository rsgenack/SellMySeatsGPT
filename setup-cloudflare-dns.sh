#!/bin/bash

# Script to set up DNS record in Cloudflare for sellmyseats.rgnack.com

echo "=== Cloudflare DNS Setup for sellmyseats.rgnack.com ==="
echo

# Obtain your Cloudflare API key
echo "Please enter your Cloudflare API token:"
read -s CF_API_TOKEN

# Obtain your Cloudflare zone ID (account ID)
echo "Enter your Cloudflare Zone ID for rgnack.com (find in your dashboard):"
read CF_ZONE_ID

# Obtain application URL
echo "Enter the URL of your deployed application (e.g., my-app.railway.app or my-app.onrender.com):"
read APP_URL

# Create CNAME record for sellmyseats.rgnack.com
echo "Creating CNAME record for sellmyseats.rgnack.com pointing to $APP_URL..."

curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data "{
       \"type\": \"CNAME\",
       \"name\": \"sellmyseats\",
       \"content\": \"$APP_URL\",
       \"ttl\": 1,
       \"proxied\": true
     }"

echo
echo "DNS record creation request sent to Cloudflare."
echo "It may take a few minutes for DNS changes to propagate."
echo
echo "To verify the setup, run:"
echo "   dig sellmyseats.rgnack.com"
echo 
echo "Next, you need to set up the custom domain on your hosting platform."
echo "Please follow your hosting platform's documentation to add the domain sellmyseats.rgnack.com" 