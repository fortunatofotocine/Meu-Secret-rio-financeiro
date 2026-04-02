export class NormalizationService {
  /**
   * Performs light, safe normalization of text for classification.
   * Focuses on unambiguous number conversion and text cleaning.
   */
  static normalize(text: string): string {
    if (!text) return "";

    let normalized = text.toLowerCase().trim();

    // 1. Basic Cleaning (Including commas and colons which break word boundaries)
    normalized = normalized.replace(/\s+/g, " "); // collapse spaces
    normalized = normalized.replace(/[?.,!:]/g, ""); // remove simple punctuation including comma and colon

    // 1.5. Greedy Prefix Cleaning (Removing greetings, bot names, and command preambles)
    const aggressivePreamble = /^(oi|ola|olá|bom dia|boa tarde|boa noite|e ai|e aí|eae|eai|opa|anota|anote|registra|registre|registra ai|anota ai|por favor)(\s+|$)/gi;
    const botMishearings = /^(zlai|delai|zial|zeli|zila|zilá|zelá|syla|delá|delia|zulia|zilai|zé lái|zé lá|ze la|zeh|zê)(\s+|$)/gi;
    
    normalized = normalized.trim()
      .replace(aggressivePreamble, "")
      .replace(botMishearings, "")
      .replace(/\s+/g, " ").trim();

    // 2. Unambiguous Number Normalization (Safe subset)
    const numberMap: { [key: string]: string } = {
      "zero": "0",
      "um": "1",
      "dois": "2",
      "três": "3",
      "quatro": "4",
      "cinco": "5",
      "seis": "6",
      "sete": "7",
      "oito": "8",
      "nove": "9",
      "dez": "10",
      "vinte": "20",
      "trinta": "30",
      "quarenta": "40",
      "cinquenta": "50",
      "sessenta": "60",
      "setenta": "70",
      "oitenta": "80",
      "noventa": "90",
      "cem": "100",
      "reais": "",
      "real": "",
    };

    // Replace words with digits if they appear as standalone words
    Object.keys(numberMap).forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      normalized = normalized.replace(regex, numberMap[word]);
    });

    // 3. Currency Symbols
    normalized = normalized.replace(/r\$\s?/g, "");

    return normalized.trim();
  }

  /**
   * Standardizes a description by removing common filler words AND bot names.
   */
  static cleanDescription(desc: string): string {
    if (!desc) return "";
    
    // 1. Remove common bot mishearings (Greedy list)
    const botPatterns = /\b(zlai|delai|zial|zeli|zila|zilá|zelá|syla|delá|delia|zulia|zé lái|zé lá|ze la|zeh|zê)\b/gi;
    let cleaned = desc.replace(botPatterns, "");

    // 2. Remove common filler prefixes
    cleaned = cleaned.replace(/^(o|a|um|uma|de|do|da|com|no|na)\s+/i, "");

    return cleaned.replace(/\s+/g, " ").trim();
  }
}
