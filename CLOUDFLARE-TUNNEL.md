# Running SellMySeats App with Cloudflare Tunnel

This document explains how to use Cloudflare Tunnel to make your locally running application available at `sellmyseats.rgnack.com` without deploying to a hosting provider.

## What is Cloudflare Tunnel?

Cloudflare Tunnel creates a secure tunnel between your local machine and Cloudflare's edge, exposing your local web server to the internet without requiring you to open ports in your firewall or set up complex networking.

## Prerequisites

- A Cloudflare account with your domain (rgnack.com) already added
- macOS or Linux machine (Windows users may need to adapt the scripts)

## Setup and Usage (Terminal Only)

### 1. One-Time Setup

Run the setup script to install cloudflared, create a tunnel, and set up DNS:

```bash
./setup-cloudflare-tunnel.sh
```

This script will:
- Install `cloudflared` if not already installed
- Log you into your Cloudflare account (via browser authentication)
- Create a tunnel named "sellmyseats"
- Configure the tunnel to route traffic to your local application
- Set up DNS to route sellmyseats.rgnack.com to your tunnel

### 2. Running the Application and Tunnel

After setup, you can run the application and tunnel together:

```bash
./run-app-with-tunnel.sh
```

This script will:
- Start your Node.js application locally
- Start the Cloudflare Tunnel
- Make your application accessible at https://sellmyseats.rgnack.com

To stop both services, press Ctrl+C in the terminal window.

### 3. Manual Operation (if needed)

If you prefer to run the services separately:

```bash
# Terminal 1: Run the app
npm run dev

# Terminal 2: Run the tunnel
cloudflared tunnel run sellmyseats
```

## How It Works

1. Your application runs on your local machine (http://localhost:5001)
2. Cloudflared creates an encrypted tunnel to Cloudflare's network
3. Cloudflare routes requests to sellmyseats.rgnack.com through the tunnel to your local app
4. Traffic is encrypted and your IP address remains private

## Troubleshooting

### Cannot access the site
- Make sure both the application and tunnel are running
- Check that the application is running on port 5001 (configured in the tunnel)
- Verify DNS propagation with `dig sellmyseats.rgnack.com`

### Authentication Issues
- If you need to re-authenticate: `cloudflared tunnel login`

### Tunnel Errors
- List tunnels: `cloudflared tunnel list`
- Delete a tunnel: `cloudflared tunnel delete sellmyseats`

## Advantages of This Approach

- No need to deploy to a hosting provider
- Fully terminal-based setup and operation
- Uses Cloudflare for SSL/TLS and security
- No port-forwarding or firewall changes needed
- Your development machine can be behind NAT/firewalls 