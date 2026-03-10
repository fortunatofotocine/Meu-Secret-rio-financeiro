import * as dotenv from "dotenv";

dotenv.config();

async function listModelsRaw() {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log("Response from v1/models:");
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error fetching models:", error);
    }
}

listModelsRaw();
