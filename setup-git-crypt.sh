#!/bin/bash

# Install git-crypt if not already installed
if ! command -v git-crypt &> /dev/null; then
    echo "git-crypt is not installed. Please install it first:"
    echo "brew install git-crypt  # if you're using macOS with Homebrew"
    exit 1
fi

# Initialize git-crypt in the repository
git-crypt init

# Create .gitattributes file to specify which files to encrypt
cat > .gitattributes << EOL
.env filter=git-crypt diff=git-crypt
secrets/** filter=git-crypt diff=git-crypt
EOL

# Create a directory for storing other secrets
mkdir -p secrets

# Export the key for sharing with trusted team members
git-crypt export-key ./git-crypt-key

echo "git-crypt has been set up. The .env file will now be encrypted in the repository."
echo "IMPORTANT: Keep the git-crypt-key file secure and share it only with trusted team members."
echo "They will need to run: git-crypt unlock /path/to/git-crypt-key" 