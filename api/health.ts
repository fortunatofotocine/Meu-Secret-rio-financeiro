import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ 
    status: "ok", 
    message: "Zero-config Health Check", 
    timestamp: new Date().toISOString() 
  });
}
