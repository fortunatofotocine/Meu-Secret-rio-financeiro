
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function checkModels() {
    console.log("--- DIAGNÓSTICO DE MODELOS GEMINI ---");
    const modelsToTest = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash-8b", "gemini-2.0-flash", "gemini-2.0-flash-lite-preview-02-05"];

    for (const modelName of modelsToTest) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Oi");
            console.log(`[OK] Model: ${modelName} - Respondeu: ${result.response.text().substring(0, 10)}...`);
        } catch (err: any) {
            console.log(`[ERRO] Model: ${modelName} - Detalhe: ${err.message}`);
        }
    }
}

checkModels();
