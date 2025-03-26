#!/bin/bash

# This script will help you upload secrets to GitHub repository
# You'll need to have the GitHub CLI (gh) installed and authenticated

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) is not installed. Please install it first:"
    echo "https://cli.github.com/manual/installation"
    exit 1
fi

# Check if user is authenticated with GitHub
if ! gh auth status &> /dev/null; then
    echo "You need to authenticate with GitHub first. Run: gh auth login"
    exit 1
fi

# The repository name
REPO="rsgenack/SellMySeatsGPT"

# Read from .env file and set each line as a secret
while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    if [[ "$line" =~ ^#.*$ ]] || [[ -z "$line" ]]; then
        continue
    fi
    
    # Extract key and value
    key=$(echo "$line" | cut -d '=' -f 1)
    value=$(echo "$line" | cut -d '=' -f 2-)
    
    echo "Setting secret: $key"
    echo "$value" | gh secret set "$key" --repo "$REPO"
done < .env

echo "All secrets from .env have been set in the GitHub repository." 