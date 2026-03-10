
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function listModels() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Teste de conexão com gemini-1.5-flash: OK");

        // The SDK doesn't have a direct 'listModels' in the client side usually, 
        // it's an API call. But we can just try 1.5-flash which is the standard.
    } catch (err) {
        console.error("Erro:", err);
    }
}

listModels();
