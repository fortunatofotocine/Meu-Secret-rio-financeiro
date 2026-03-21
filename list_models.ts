import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function list() {
  try {
    const models = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // dummy to get the client
    // @ts-ignore - listModels is not in the type but exists in the prototype/client
    const result = await (genAI as any).listModels();
    console.log("ALIVE MODELS:");
    for (const model of result.models) {
      console.log(`- ${model.name} (${model.supportedGenerationMethods})`);
    }
  } catch (e: any) {
    console.error("Error listing models:", e.message);
  }
}

list();
