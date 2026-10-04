const captureButton = document.getElementById('capture-button');
const jpgButton = document.getElementById('jpg-button');
const pngButton = document.getElementById('png-button');
const pdfButton = document.getElementById('pdf-button');
const againButton = document.getElementById('again-button');
const startView = document.getElementById('start-view');
const resultView = document.getElementById('result-view');
const preview = document.getElementById('preview');
const errorMessage = document.getElementById('error-message');
const downloadMessage = document.getElementById('download-message');

let capturedPngUrl = '';
let capturedJpgUrl = '';
let imageInfo = null;

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  if (busy) button.dataset.originalLabel = button.textContent;
  button.textContent = busy ? label : button.dataset.originalLabel;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function canvasToJpeg(pngUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.95), width: canvas.width, height: canvas.height });
    };
    image.onerror = () => reject(new Error('The captured image could not be processed.'));
    image.src = pngUrl;
  });
}

function makePdfFromJpeg(jpegUrl, width, height) {
  const jpegBytes = dataUrlToBytes(jpegUrl);
  const encoder = new TextEncoder();
  // A page with the same pixel aspect ratio; points are used at 72 dpi.
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const catalog = add('<< /Type /Catalog /Pages 2 0 R >>');
  const pages = add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  const page = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = encoder.encode(content);
  const contentIndex = 3;
  objects[contentIndex] = { prefix: `<< /Length ${contentBytes.length} >>\nstream\n`, bytes: contentBytes, suffix: '\nendstream' };
  const imageIndex = add({ prefix: `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`, bytes: jpegBytes, suffix: '\nendstream' });
  const header = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';
  const chunks = [encoder.encode(header)];
  const offsets = [0];
  let totalLength = chunks[0].length;
  objects.forEach((object, index) => {
    offsets[index + 1] = totalLength;
    const body = typeof object === 'string' ? encoder.encode(object) : concatBytes([encoder.encode(object.prefix), object.bytes, encoder.encode(object.suffix)]);
    const objectBytes = concatBytes([encoder.encode(`${index + 1} 0 obj\n`), body, encoder.encode('\nendobj\n')]);
    chunks.push(objectBytes);
    totalLength += objectBytes.length;
  });
  const xrefOffset = totalLength;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(encoder.encode(xref));
  return new Blob(chunks, { type: 'application/pdf' });
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

async function downloadBlob(blob, extension) {
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({ url, filename: `screenshot-${timestamp()}.${extension}`, saveAs: false });
    downloadMessage.textContent = `${extension.toUpperCase()} downloaded.`;
    downloadMessage.hidden = false;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

captureButton.addEventListener('click', async () => {
  errorMessage.hidden = true;
  setBusy(captureButton, true, 'Capturing…');
  try {
    capturedPngUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
    imageInfo = await canvasToJpeg(capturedPngUrl);
    capturedJpgUrl = imageInfo.dataUrl;
    preview.src = capturedJpgUrl;
    startView.hidden = true;
    resultView.hidden = false;
  } catch (error) {
    showError('Chrome cannot capture this page. Try a normal webpage instead of a Chrome settings or store page.');
  } finally {
    setBusy(captureButton, false);
  }
});

jpgButton.addEventListener('click', async () => {
  try { await downloadBlob(new Blob([dataUrlToBytes(capturedJpgUrl)], { type: 'image/jpeg' }), 'jpg'); }
  catch { downloadMessage.textContent = 'Could not download the JPG.'; downloadMessage.hidden = false; }
});

pngButton.addEventListener('click', async () => {
  try { await downloadBlob(new Blob([dataUrlToBytes(capturedPngUrl)], { type: 'image/png' }), 'png'); }
  catch { downloadMessage.textContent = 'Could not download the PNG.'; downloadMessage.hidden = false; }
});

pdfButton.addEventListener('click', async () => {
  try { await downloadBlob(makePdfFromJpeg(capturedJpgUrl, imageInfo.width, imageInfo.height), 'pdf'); }
  catch { downloadMessage.textContent = 'Could not download the PDF.'; downloadMessage.hidden = false; }
});

againButton.addEventListener('click', () => {
  resultView.hidden = true;
  startView.hidden = false;
  downloadMessage.hidden = true;
  preview.removeAttribute('src');
});
