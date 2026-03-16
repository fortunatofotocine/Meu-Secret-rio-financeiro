import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const p = path.join(process.cwd(), 'public', 'zlai-logo.png');

async function run() {
  try {
    console.log("Iniciando trim absoluto... Lendo: " + p);
    const data = await sharp(p).trim({ threshold: Math.floor(255 * 0.1) }).toBuffer();
    const meta = await sharp(data).metadata();
    console.log(`Bordas removidas! Nova resolucao: ${meta.width}x${meta.height}`);
    fs.writeFileSync(p, data);
    console.log("Concluido!");
  } catch (e) {
    console.error("ERRO:", e);
  }
}
run();
