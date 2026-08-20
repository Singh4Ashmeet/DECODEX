const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src/db');
const distDir = path.join(__dirname, '../dist/db');

fs.mkdirSync(distDir, { recursive: true });

if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    if (file.endsWith('.sql')) {
      fs.copyFileSync(path.join(srcDir, file), path.join(distDir, file));
    }
  }
}
