const QRCode = require('qrcode');
const path = require('path');

const url = 'https://burcu-osmanemre.vercel.app/';
const outputPath = path.join(__dirname, 'public', 'qr-kod.png');

QRCode.toFile(outputPath, url, {
  width: 1000,
  margin: 2,
  color: {
    dark: '#1a1a1a',  // Black color matching our theme accent
    light: '#ffffff'  // Clean white background for reliable scanning
  }
}, function (err) {
  if (err) {
    console.error('Error generating QR Code:', err);
    process.exit(1);
  }
  console.log('QR Code successfully generated at:', outputPath);
});
