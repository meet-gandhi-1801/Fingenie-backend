const fs = require('fs');
const path = require('path');

async function main() {
  const fileArg = process.argv[2] || 'sample.pdf';
  const filePath = path.resolve(fileArg);

  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  let pdfParseModule;
  try {
    pdfParseModule = require('pdf-parse');
  } catch (err) {
    console.error('Failed to require pdf-parse:', err && err.message);
    process.exit(1);
  }

  console.log('pdf-parse module type:', typeof pdfParseModule, 'keys:', Object.keys(pdfParseModule));

  const pdfParse = (typeof pdfParseModule === 'function')
    ? pdfParseModule
    : (pdfParseModule && typeof pdfParseModule.default === 'function' ? pdfParseModule.default : null);

  // Reuse project's helper to normalize binaries
  let toUint8Array;
  try {
    ({ toUint8Array } = require('../services/statements/pdfParser'));
  } catch (e) {
    // ignore; we'll fallback to local conversion below
  }

  if (!pdfParse) {
    console.error('pdf-parse did not expose a callable function. Exiting.');
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);

  // Convert Buffer/ArrayBuffer to Uint8Array to satisfy pdfjs expectations
  const uint8Data = (typeof toUint8Array === 'function') ? toUint8Array(buffer) : (buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));

  try {
    const data = await pdfParse(uint8Data);
    console.log('Extracted text length:', data && data.text ? data.text.length : 0);
    console.log('Sample text (first 400 chars):\n', (data && data.text) ? data.text.slice(0, 400) : '<no-text>');
  } catch (err) {
    console.error('pdfParse call failed:', err);
    process.exit(1);
  }
}

main();
