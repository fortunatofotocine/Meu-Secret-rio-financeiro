import axios from "axios";

export class WhatsAppMessagingService {
  /**
   * Centralized method to send a WhatsApp message using the Meta API.
   */
  static async sendMessage(to: string, text: string): Promise<any> {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      console.error(`[WhatsAppMessaging] Missing configuration. Token: ${!!accessToken}, ID: ${!!phoneNumberId}`);
      throw new Error("Missing WhatsApp API configuration.");
    }

    // WhatsApp expects numbers without '+' and specialized formatting
    const formattedTo = to.replace(/\D/g, "");

    try {
      const response = await axios.post(
        `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedTo,
          type: "text",
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error: any) {
      const detail = error.response?.data || error.message;
      console.error("[WhatsAppMessaging] Error sending message:", JSON.stringify(detail));
      throw error;
    }
  }
}
