# Deploying SellMySeats to sellmyseats.rgnack.com

This document outlines how to deploy the SellMySeats application to a production environment at sellmyseats.rgnack.com using Cloudflare Pages.

## Prerequisites

- A Cloudflare account with access to the rgnack.com domain
- Node.js 16+ installed locally
- Git repository with your application code

## Deployment Options

### Option 1: Using the Deployment Script (Recommended)

1. Make sure you have the Wrangler CLI installed:
   ```
   npm install -g wrangler
   ```

2. Log in to your Cloudflare account:
   ```
   wrangler login
   ```

3. Run the deployment script:
   ```
   ./deploy-to-cloudflare.sh
   ```

4. Follow the on-screen instructions.

### Option 2: Manual Deployment

1. Build the application:
   ```
   npm run build
   ```

2. Install Wrangler CLI if not already installed:
   ```
   npm install -g wrangler
   ```

3. Log in to Cloudflare:
   ```
   wrangler login
   ```

4. Deploy the application:
   ```
   wrangler deploy
   ```

5. Set up your environment variables in the Cloudflare dashboard.

## Setting up the Domain

1. Log in to your Cloudflare dashboard
2. Go to the Workers & Pages section
3. Find your deployed project (sellmyseats-rgnack)
4. Navigate to Settings > Custom domains
5. Add your custom domain: sellmyseats.rgnack.com
6. Follow the DNS setup instructions provided by Cloudflare

## Environment Variables

You'll need to set up these environment variables in your Cloudflare dashboard:

### Database Configuration
- PGDATABASE
- PGPORT
- PGUSER
- PGHOST
- PGPASSWORD
- DATABASE_URL

### Email Configuration
- EMAIL_IMAP_HOST
- EMAIL_IMAP_PORT
- EMAIL_IMAP_USER
- EMAIL_IMAP_PASSWORD

### Google API Configuration
- GMAIL_CREDENTIALS
- GOOGLE_TOKEN
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET

## Troubleshooting

### Database Connectivity Issues
If you're experiencing database connectivity issues, make sure:
- Your Neon DB allows connections from Cloudflare's IP ranges
- Database credentials are correctly set in environment variables

### Deployment Failures
If deployment fails:
1. Check the error message in the terminal
2. Verify your wrangler.toml configuration
3. Ensure your project is correctly built

For more detailed logs, run:
```
wrangler tail
```

### Custom Domain Issues
If your custom domain is not working:
1. Verify DNS settings in your Cloudflare dashboard
2. Ensure the domain is properly linked to your worker
3. Check for any SSL/TLS certificate issues 