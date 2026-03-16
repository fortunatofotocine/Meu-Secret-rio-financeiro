const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = 'e:\\VISION LION\\MEU ASSISTENTE FINANCEIRO\\secretário-financeiro\\public';
const sourceFile = path.join(publicDir, 'zlai-logo.png');

async function trimLogo() {
  console.log('Iniciando trim do zlai-logo.png...');
  
  const trimmed = await sharp(sourceFile)
    .trim({ threshold: Math.floor(255 * 0.1) })
    .toBuffer();
    
  const meta = await sharp(trimmed).metadata();
  console.log(`Nova dimensão: ${meta.width}x${meta.height}`);

  fs.writeFileSync(sourceFile, trimmed);
  console.log('Sobrescrito com sucesso!');
}

trimLogo().catch(O_o => console.error(O_o));
