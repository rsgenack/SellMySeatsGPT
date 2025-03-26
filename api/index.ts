import type { VercelRequest, VercelResponse } from '@vercel/node';

interface EnvironmentInfo {
  NODE_ENV: string | undefined;
  VERCEL_ENV: string | undefined;
  VERCEL_REGION: string | undefined;
}

interface ApiResponse {
  status: 'ok' | 'error';
  message: string;
  timestamp: string;
  environment?: EnvironmentInfo;
  path?: string;
  method?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log('Received request:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  try {
    const response: ApiResponse = {
      status: 'ok',
      message: 'API is running',
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_REGION: process.env.VERCEL_REGION
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error handling request:', error);
    
    const errorResponse: ApiResponse = {
      status: 'error',
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    };

    res.status(500).json(errorResponse);
  }
} 