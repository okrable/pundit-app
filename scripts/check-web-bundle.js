const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');
const forbiddenText = 'Native Bottom Tabs are not supported on this platform.';
const requiredHomeScreenAssets = [
  'apple-touch-icon.png',
  'icon-192x192.png',
  'icon-512x512.png',
  'site.webmanifest',
];

function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listJavaScriptFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
  });
}

if (!fs.existsSync(distDir)) {
  throw new Error('Web bundle guard could not find the dist directory.');
}

const missingHomeScreenAsset = requiredHomeScreenAssets.find(
  (asset) => !fs.existsSync(path.join(distDir, asset))
);
if (missingHomeScreenAsset) {
  throw new Error(`Web bundle is missing home-screen asset: ${missingHomeScreenAsset}`);
}

const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
if (!indexHtml.includes('rel="apple-touch-icon"') || !indexHtml.includes('rel="manifest"')) {
  throw new Error('Web bundle is missing home-screen icon metadata.');
}

const unsafeBundle = listJavaScriptFiles(distDir).find((filePath) =>
  fs.readFileSync(filePath, 'utf8').includes(forbiddenText)
);

if (unsafeBundle) {
  throw new Error(
    `Web bundle includes the unsupported native-tabs runtime: ${path.relative(
      distDir,
      unsafeBundle
    )}`
  );
}

console.log('Web bundle excludes the unsupported native-tabs runtime.');
console.log('Web bundle includes home-screen icons and metadata.');
