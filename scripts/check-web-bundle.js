const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');
const forbiddenText = 'Native Bottom Tabs are not supported on this platform.';

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
