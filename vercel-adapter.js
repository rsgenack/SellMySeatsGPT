// This file is a specialized adapter for running the application on Vercel
import './dist/start.js';

// Export a simple handler function for Vercel
export default function handler(req, res) {
  // This function will be automatically used by the @vercel/node runtime
  // The actual handling is done by importing the start.js file above
  // which initializes our Express application
} 