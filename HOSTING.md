# Hosting SellMySeats on Railway or Render

This application is a full Node.js application with many dependencies that work best on a traditional Node.js hosting platform. Here are instructions for deploying to Railway or Render, and then setting up your custom domain in Cloudflare.

## Option 1: Deploy to Railway

1. **Sign up for Railway**:
   - Go to [railway.app](https://railway.app/) and sign up
   - Connect with your GitHub account

2. **Create a new project**:
   - Choose "Deploy from GitHub repo"
   - Select your repository: `rsgenack/SellMySeatsGPT`

3. **Configure the deployment**:
   - Railway will automatically detect that this is a Node.js application
   - In the "Variables" tab, add all your environment variables from `.env`
   - The `railway.toml` file is already set up for Railway

4. **Add your custom domain**:
   - In the "Settings" tab, find "Custom Domain"
   - Add `sellmyseats.rgnack.com`
   - Follow the instructions to verify ownership

## Option 2: Deploy to Render

1. **Sign up for Render**:
   - Go to [render.com](https://render.com/) and sign up
   - Connect with your GitHub account

2. **Create a new Web Service**:
   - Choose "Deploy from GitHub repo"
   - Select your repository: `rsgenack/SellMySeatsGPT`

3. **Configure the service**:
   - Set the name to `sellmyseats`
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - In the "Environment" section, add all variables from `.env`

4. **Add your custom domain**:
   - Go to the "Settings" tab
   - Find "Custom Domain"
   - Add `sellmyseats.rgnack.com`
   - Follow the instructions to verify ownership

## Setting up Cloudflare DNS

After deploying to your hosting platform, you need to set up a DNS record in Cloudflare to point to your application:

1. **Run the included script**:
   ```
   ./setup-cloudflare-dns.sh
   ```
   
   You'll need:
   - Your Cloudflare API token
   - Your Cloudflare Zone ID for rgnack.com
   - The URL of your deployed application (e.g., `your-app.railway.app`)

2. **Manual setup**:
   - Log in to your Cloudflare dashboard
   - Go to the DNS section for rgnack.com
   - Create a new CNAME record:
     - Type: CNAME
     - Name: sellmyseats
     - Target: Your app URL (e.g., your-app.railway.app)
     - Proxy status: Proxied (orange cloud)

3. **Verify the setup**:
   - Run `dig sellmyseats.rgnack.com`
   - Wait a few minutes for DNS propagation
   - Visit https://sellmyseats.rgnack.com in your browser

## Troubleshooting

### DNS Issues
- DNS changes can take time to propagate (up to 48 hours)
- Use `dig sellmyseats.rgnack.com` to check the current DNS status
- Make sure the CNAME record is pointing to the correct host

### Application Not Loading
- Check the logs in your hosting platform
- Verify all environment variables are set correctly
- Ensure the application builds and starts locally with `npm run build && npm start` 