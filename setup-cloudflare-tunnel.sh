#!/bin/bash

# Script to set up Cloudflare Tunnel for sellmyseats.rgnack.com

echo "=== Setting up Cloudflare Tunnel for sellmyseats.rgnack.com ==="
echo

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "Installing cloudflared..."
    # macOS installation
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install cloudflared
    # Linux installation
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        sudo dpkg -i cloudflared.deb
        rm cloudflared.deb
    else
        echo "Unsupported OS. Please install cloudflared manually."
        exit 1
    fi
fi

echo "Logging in to Cloudflare..."
cloudflared tunnel login

echo "Creating a tunnel named 'sellmyseats'..."
TUNNEL_ID=$(cloudflared tunnel create sellmyseats | grep -o "Created tunnel sellmyseats with id [a-z0-9-]*" | grep -o "[a-z0-9-]*$")

if [ -z "$TUNNEL_ID" ]; then
    echo "Failed to create tunnel. Please check the output above."
    exit 1
fi

echo "Tunnel created with ID: $TUNNEL_ID"

# Create config file
echo "Creating tunnel configuration file..."
mkdir -p ~/.cloudflared

cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: ~/.cloudflared/${TUNNEL_ID}.json
ingress:
  - hostname: sellmyseats.rgnack.com
    service: http://localhost:5001
  - service: http_status:404
EOF

echo "Creating DNS record for sellmyseats.rgnack.com..."
cloudflared tunnel route dns $TUNNEL_ID sellmyseats.rgnack.com

echo
echo "Tunnel setup complete!"
echo
echo "To start your application and tunnel, run these commands in separate terminal windows:"
echo
echo "Terminal 1 (Application):"
echo "   npm run dev"
echo
echo "Terminal 2 (Tunnel):"
echo "   cloudflared tunnel run sellmyseats"
echo
echo "Your application will be available at: https://sellmyseats.rgnack.com"
echo
echo "NOTE: Keep both terminal windows open. The tunnel only works while 'cloudflared tunnel run' is running." 