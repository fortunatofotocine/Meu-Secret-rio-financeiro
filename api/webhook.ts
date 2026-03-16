import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  // POST: Handling WhatsApp Webhook Notifications (Text Only Phase)
  if (req.method === 'POST') {
    const body = req.body;

    // Early exit if it's not a WhatsApp business account object
    if (body.object !== 'whatsapp_business_account') {
      return res.status(200).send('OK');
    }

    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      // Requisitos: responder apenas mensagens do tipo text
      if (message && message.type === 'text') {
        const from = message.from;
        const msgBody = message.text?.body;
        const phone_number_id = value?.metadata?.phone_number_id;

        console.log(`[WhatsApp] Mensagem recebida de ${from}: "${msgBody}"`);

        if (!msgBody) {
          console.log('[WhatsApp] Mensagem ignorada: corpo vazio.');
          return res.status(200).send('OK');
        }

        // 1. Gemini Integration
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

        const prompt = `Você é a assistente da ZLAI. Responda de forma curta, clara e útil, em português do Brasil. Não invente dados. Se a mensagem estiver ambígua, peça esclarecimento. Não use markdown, listas ou formatação especial. Responda somente com texto simples.\n\nMensagem do usuário: ${msgBody}`;

        let aiResponseText = "";
        try {
          const result = await model.generateContent(prompt);
          aiResponseText = result.response.text().trim();
          console.log(`[Gemini] Resposta gerada: "${aiResponseText}"`);
        } catch (aiErr) {
          console.error('[Gemini] Erro ao gerar conteúdo:', aiErr);
          aiResponseText = "Não consegui entender sua mensagem. Pode tentar novamente?";
        }

        // 2. WhatsApp Reply Sender
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        if (!accessToken || !phone_number_id) {
          console.error('[WhatsApp] Erro: WHATSAPP_ACCESS_TOKEN ou phone_number_id faltando.');
          return res.status(200).send('OK');
        }

        try {
          const whatsappUrl = `https://graph.facebook.com/v18.0/${phone_number_id}/messages`;
          const response = await fetch(whatsappUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: from,
              type: 'text',
              text: { body: aiResponseText },
            }),
          });

          const whatsappResult = await response.json();
          console.log('[WhatsApp] Resposta enviada. Status:', response.status);
          console.log('[WhatsApp] Detalhes do retorno:', JSON.stringify(whatsappResult));
        } catch (waErr) {
          console.error('[WhatsApp] Erro ao enviar mensagem:', waErr);
        }
      } else {
        console.log('[WhatsApp] Mensagem ignorada: não é do tipo texto.');
      }

      return res.status(200).send('OK');
    } catch (err) {
      console.error('[Webhook] Erro geral no processamento do POST:', err);
      return res.status(200).send('OK'); // Always return 200 to Meta to avoid retry loops on minor errors
    }
  }

  // Method Not Allowed
  return res.status(405).end();
}
