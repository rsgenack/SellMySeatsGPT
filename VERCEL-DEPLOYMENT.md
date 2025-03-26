# Deploying SellMySeats to Vercel

This guide explains how to deploy the SellMySeats application to Vercel and set up your custom domain.

## Prerequisites

- A Vercel account linked to your GitHub account
- Your domain (e.g., rgnack.com) managed in Cloudflare or another DNS provider

## Deployment Options

### Option 1: Using the Vercel Dashboard (Easiest)

1. **Log in to Vercel Dashboard**:
   - Go to [vercel.com](https://vercel.com) and log in

2. **Import Your GitHub Repository**:
   - Click "Add New" → "Project"
   - Select the GitHub repository `rsgenack/SellMySeatsGPT`
   - Click "Import"

3. **Configure Project**:
   - Project Name: `sellmyseats` (or your preferred name)
   - Framework Preset: `Other`
   - Root Directory: `./` (default)
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Environment Variables**:
   - Click "Environment Variables"
   - Add all variables from your `.env` file
   - Make sure to add `NODE_ENV=production`

5. **Deploy**:
   - Click "Deploy"
   - Wait for the build and deployment to complete

### Option 2: Using the Deployment Script (Terminal)

We've created a script to simplify deployment from your terminal:

```bash
./deploy-to-vercel.sh
```

This script will:
- Install the Vercel CLI if needed
- Log you in to Vercel
- Build your application
- Deploy to Vercel
- Help you set up a custom domain

## Setting Up Your Custom Domain

### From Vercel Dashboard

1. Go to your project in the Vercel dashboard
2. Click on "Settings" → "Domains"
3. Enter your domain: `sellmyseats.rgnack.com`
4. Click "Add"
5. Follow Vercel's instructions for DNS configuration

### DNS Configuration in Cloudflare

1. Log in to your Cloudflare dashboard
2. Go to the DNS section for rgnack.com
3. Add a new CNAME record:
   - Type: CNAME
   - Name: sellmyseats
   - Target: cname.vercel-dns.com
   - Proxy status: DNS only (gray cloud) - This is important for Vercel

## Environment Variables

When deploying to Vercel, you'll need to set up the following environment variables:

- Database connection variables:
  - `PGDATABASE`
  - `PGPORT`
  - `PGUSER`
  - `PGHOST`
  - `PGPASSWORD`
  - `DATABASE_URL`

- Email and Gmail configuration:
  - `EMAIL_IMAP_HOST`
  - `EMAIL_IMAP_PORT`
  - `EMAIL_IMAP_USER`
  - `EMAIL_IMAP_PASSWORD`
  - `GMAIL_CREDENTIALS`
  - `GOOGLE_TOKEN`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`

You can set these in the Vercel dashboard or using the Vercel CLI:

```bash
vercel env add PGDATABASE
```

## Troubleshooting

### Build Failures
- Check build logs in the Vercel dashboard
- Ensure all dependencies are properly configured
- Verify that your build script works locally with `npm run build`

### Database Connectivity Issues
- Ensure your database allows connections from Vercel's IP ranges
- Verify your database credentials are correctly set in environment variables

### Domain Issues
- DNS propagation can take up to 48 hours
- Ensure you've set up the CNAME record as instructed
- Make sure to use the "DNS only" setting in Cloudflare (gray cloud, not orange)

### Admin Access
- Remember that admin access is restricted to `greenbaumamichael@gmail.com` with password `michael101` 