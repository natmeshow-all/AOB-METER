#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🌐 PowerView i18n Automated Parity & Quality Audit');
console.log('==================================================');

// 1. Read LanguageContext.jsx
const langContextPath = path.join(rootDir, 'src', 'context', 'LanguageContext.jsx');
if (!fs.existsSync(langContextPath)) {
  console.error(`❌ LanguageContext not found at ${langContextPath}`);
  process.exit(1);
}

const langSource = fs.readFileSync(langContextPath, 'utf-8');

// Helper to extract keys from an object string block
function extractKeysFromBlock(blockStr) {
  const keys = new Set();
  const lines = blockStr.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    const match = trimmed.match(/^([a-zA-Z0-9_]+)\s*:/);
    if (match && match[1] !== 'th' && match[1] !== 'en') {
      keys.add(match[1]);
    }
  }
  return keys;
}

// Slice th and en blocks
const thIndex = langSource.indexOf('th: {');
const enIndex = langSource.indexOf('en: {');
const endOfTranslations = langSource.indexOf('};\n\nconst LanguageContext', enIndex);

if (thIndex === -1 || enIndex === -1) {
  console.error('❌ Could not locate th: or en: translation blocks.');
  process.exit(1);
}

const thBlock = langSource.substring(thIndex, enIndex);
const enBlock = langSource.substring(enIndex, endOfTranslations !== -1 ? endOfTranslations : undefined);

const thKeys = extractKeysFromBlock(thBlock);
const enKeys = extractKeysFromBlock(enBlock);

console.log(`📦 Dictionary Keys Count:`);
console.log(`   - Thai (th):    ${thKeys.size} keys`);
console.log(`   - English (en): ${enKeys.size} keys`);

// Check missing in EN
const missingInEn = [...thKeys].filter((k) => !enKeys.has(k));
// Check missing in TH
const missingInTh = [...enKeys].filter((k) => !thKeys.has(k));

let hasErrors = false;

if (missingInEn.length > 0) {
  hasErrors = true;
  console.error(`\n❌ Keys present in TH but MISSING in EN (${missingInEn.length}):`);
  missingInEn.forEach((k) => console.error(`   - ${k}`));
}

if (missingInTh.length > 0) {
  hasErrors = true;
  console.error(`\n❌ Keys present in EN but MISSING in TH (${missingInTh.length}):`);
  missingInTh.forEach((k) => console.error(`   - ${k}`));
}

if (!hasErrors) {
  console.log('✅ 100% Parity: Every key in TH exists in EN and vice versa.');
}

// 2. Scan JSX components for t('key') usage
const componentsDir = path.join(rootDir, 'src', 'components');
const filesToScan = [];

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.jsx') || entry.name.endsWith('.js'))) {
      filesToScan.push(fullPath);
    }
  }
}

walkDir(componentsDir);
walkDir(path.join(rootDir, 'src', 'context'));
if (fs.existsSync(path.join(rootDir, 'src', 'App.jsx'))) {
  filesToScan.push(path.join(rootDir, 'src', 'App.jsx'));
}

const tCallRegex = /\bt\(\s*['"]([a-zA-Z0-9_]+)['"]\s*[,)]/g;
const missingDictKeys = new Map();

for (const filePath of filesToScan) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let match;
  while ((match = tCallRegex.exec(content)) !== null) {
    const key = match[1];
    if (!thKeys.has(key) && !enKeys.has(key)) {
      if (!missingDictKeys.has(key)) missingDictKeys.set(key, []);
      missingDictKeys.get(key).push(path.relative(rootDir, filePath));
    }
  }
}

if (missingDictKeys.size > 0) {
  hasErrors = true;
  console.error(`\n❌ Found t('key') calls with UNDEFINED keys in dictionary (${missingDictKeys.size}):`);
  for (const [key, files] of missingDictKeys.entries()) {
    console.error(`   - "${key}" in: ${files.join(', ')}`);
  }
} else {
  console.log(`✅ All t(...) calls in ${filesToScan.length} files correspond to valid translation keys.`);
}

console.log('==================================================');
if (hasErrors) {
  console.error('❌ i18n parity check FAILED. Please resolve the missing keys.');
  process.exit(1);
} else {
  console.log('🎉 i18n parity check PASSED successfully! (0 errors)');
  process.exit(0);
}
