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
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
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