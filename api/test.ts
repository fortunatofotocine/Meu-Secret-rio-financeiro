import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ 
    status: "Vercel Functions are active!", 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
}
