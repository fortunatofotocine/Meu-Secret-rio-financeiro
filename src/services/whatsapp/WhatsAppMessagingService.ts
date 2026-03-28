import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

export class WhatsAppMessagingService {
  /**
   * Centralized method to send a WhatsApp message using the Meta API.
   */
  static async sendMessage(to: string, text: string): Promise<any> {
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.error("[WhatsAppMessaging] Missing API configuration.");
      throw new Error("Missing WhatsApp API configuration.");
    }

    // WhatsApp expects numbers without '+' and specialized formatting
    const formattedTo = to.replace(/\D/g, "");

    try {
      const response = await axios.post(
        `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedTo,
          type: "text",
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
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
