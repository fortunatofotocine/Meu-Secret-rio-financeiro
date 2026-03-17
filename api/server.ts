export default function handler(req: any, res: any) {
  res.status(200).json({
    message: "Dynamic routing debug successful",
    method: req.method,
    url: req.url,
    query: req.query,
    env: {
      hasGemini: !!process.env.GEMINI_API_KEY,
      hasSupabase: !!process.env.SUPABASE_URL,
      hasWhatsApp: !!process.env.WHATSAPP_ACCESS_TOKEN
    }
  });
}
