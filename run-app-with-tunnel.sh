#!/bin/bash

# Script to run both the application and Cloudflare Tunnel

echo "=== Starting SellMySeats with Cloudflare Tunnel ==="
echo

# Check if the tunnel is set up
if ! cloudflared tunnel list | grep -q sellmyseats; then
    echo "Error: Tunnel 'sellmyseats' not found."
    echo "Please run './setup-cloudflare-tunnel.sh' first."
    exit 1
fi

# Function to clean up processes on script exit
cleanup() {
    echo "Stopping processes..."
    if [ -n "$NODE_PID" ]; then
        kill $NODE_PID
    fi
    if [ -n "$TUNNEL_PID" ]; then
        kill $TUNNEL_PID
    fi
    exit 0
}

# Set up trap for clean exit
trap cleanup EXIT INT TERM

# Start the application
echo "Starting the application..."
npm run dev &
NODE_PID=$!

# Wait a bit for the app to initialize
sleep 5

# Start the tunnel
echo "Starting Cloudflare Tunnel..."
cloudflared tunnel run sellmyseats &
TUNNEL_PID=$!

echo
echo "=== Services Started ==="
echo "Application running on http://localhost:5001"
echo "Tunnel exposing at https://sellmyseats.rgnack.com"
echo
echo "Press Ctrl+C to stop both services"

# Wait for any process to exit
wait $NODE_PID $TUNNEL_PID 