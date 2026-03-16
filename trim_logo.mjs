import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = 'e:\\VISION LION\\MEU ASSISTENTE FINANCEIRO\\secretário-financeiro\\public';
const sourceFile = path.join(publicDir, 'zlai-logo.png');
const tempFile = path.join(publicDir, 'zlai-logo-temp.png');

async function trimLogo() {
  console.log('Iniciando trim do zlai-logo.png...');
  
  // O sharp.trim() detecta e remove o fundo automaticamente.
  // Usamos um threshold de 20 para limpar artefatos jpg de borda se houver.
  const trimmed = await sharp(sourceFile)
    .trim({ threshold: 20 })
    .toBuffer();
    
  const meta = await sharp(trimmed).metadata();
  console.log(`Logotipo redimensionado organicamente para o tamanho real do conteudo: ${meta.width}x${meta.height}`);

  // Substituímos o arquivo
  fs.writeFileSync(sourceFile, trimmed);
  console.log('Sobrescrito com sucesso!');
}

trimLogo().catch(O_o => console.error(O_o));
