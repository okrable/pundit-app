const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const indexPath = path.join(distDir, 'index.html');
const faviconDir = path.join(projectRoot, 'assets', 'favicon');

const assets = [
  'apple-touch-icon.png',
  'icon-192x192.png',
  'icon-512x512.png',
  'site.webmanifest',
];

if (!fs.existsSync(indexPath)) {
  throw new Error('Web asset preparation could not find dist/index.html.');
}

for (const asset of assets) {
  fs.copyFileSync(path.join(faviconDir, asset), path.join(distDir, asset));
}

const homeScreenMetadata = [
  '    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
  '    <link rel="manifest" href="/site.webmanifest" />',
  '    <meta name="theme-color" content="#d07158" />',
].join('\n');

const html = fs.readFileSync(indexPath, 'utf8');
const updatedHtml = html.includes('rel="apple-touch-icon"')
  ? html
  : html.replace('</head>', `${homeScreenMetadata}\n  </head>`);

if (updatedHtml === html && !html.includes('rel="apple-touch-icon"')) {
  throw new Error('Web asset preparation could not add home-screen metadata.');
}

fs.writeFileSync(indexPath, updatedHtml);
console.log('Web home-screen icons and metadata prepared.');
