import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // GET: Handling WhatsApp Webhook Verification
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === 'zlai_webhook_token') {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(challenge);
    } else {
      return res.status(403).end();
    }
  }

  // POST: Handling WhatsApp Webhook Notifications
  if (req.method === 'POST') {
    console.log('--- WhatsApp Webhook Received (Standalone API Function) ---');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    return res.status(200).send('OK');
  }

  // Method Not Allowed
  return res.status(405).end();
}
