import fs from 'fs';
import path from 'path';

const targetFile = process.argv[2];

function scanFile(full) {
  if (full.includes('LanguageContext.jsx')) return;
  const content = fs.readFileSync(full, 'utf8');
  const hasUseLang = content.includes('useLanguage');
  const lines = content.split('\n');
  let rawThaiLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/[\u0E00-\u0E7F]/.test(line)) {
      if (
        !line.startsWith('//') &&
        !line.startsWith('*') &&
        !line.startsWith('/*') &&
        !line.includes('isEn') &&
        !line.includes("lang === 'en'") &&
        !line.includes('t(')
      ) {
        rawThaiLines.push({ lineNum: i + 1, text: line.slice(0, 100) });
      }
    }
  }
  if (rawThaiLines.length > 0) {
    console.log(`\n=== ${full} (${rawThaiLines.length} untranslated Thai lines, hasUseLang: ${hasUseLang}) ===`);
    rawThaiLines.slice(0, 20).forEach(l => console.log(`  L${l.lineNum}: ${l.text}`));
    if (rawThaiLines.length > 20) console.log(`  ... and ${rawThaiLines.length - 20} more lines`);
  }
}

if (targetFile) {
  scanFile(targetFile);
} else {
  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) {
        scanDir(full);
      } else if (full.endsWith('.jsx') || full.endsWith('.js')) {
        scanFile(full);
      }
    }
  }
  scanDir('src');
}
