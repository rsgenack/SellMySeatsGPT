// Cloudflare Worker for SellMySeats application
import { createRequestHandler } from './dist/index.js';

export default {
  async fetch(request, env, ctx) {
    // Add environment variables from Cloudflare to process.env
    Object.assign(process.env, env);
    
    try {
      // Pass request to Express application
      return await createRequestHandler(request);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Server Error', { status: 500 });
    }
  }
}; 