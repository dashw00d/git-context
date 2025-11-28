const fs = require('fs');
const path = require('path');
const https = require('https');

const languages = ['typescript', 'javascript', 'php'];
const baseUrl = 'https://github.com/tree-sitter/tree-sitter-';

const outDir = path.join(__dirname, 'out');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        let newUrl = response.headers.location;
        if (newUrl.startsWith('/')) {
          const parsedUrl = new URL(url);
          newUrl = `${parsedUrl.protocol}//${parsedUrl.host}${newUrl}`;
        }
        downloadFile(newUrl, dest).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      let lastLogged = 0;

      if (totalSize) {
        console.log(`Downloading ${path.basename(dest)}: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      }

      response.pipe(file);
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const percent = Math.round((downloadedSize / totalSize) * 100);
          // Log every 10%
          if (percent - lastLogged >= 10) {
            console.log(`${path.basename(dest)}: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB)`);
            lastLogged = percent;
          }
        } else {
           // Log every 1MB if no content-length
           if (downloadedSize - lastLogged >= 1024 * 1024) {
             console.log(`${path.basename(dest)}: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB`);
             lastLogged = downloadedSize;
           }
        }
      });

      file.on('finish', () => {
        file.close();
        console.log(`Finished downloading ${path.basename(dest)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// URLs for pre-built WASM files
const wasmUrls = {
    'bash': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-bash.wasm',
    'c': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-c.wasm',
    'cpp': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-cpp.wasm',
    'c_sharp': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-c_sharp.wasm',
    'css': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-css.wasm',
    'go': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-go.wasm',
    'html': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-html.wasm',
    'java': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-java.wasm',
    'javascript': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-javascript.wasm',
    'json': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-json.wasm',
    'php': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-php.wasm',
    'python': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-python.wasm',
    'ruby': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-ruby.wasm',
    'rust': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-rust.wasm',
    'scala': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-scala.wasm',
    'tsx': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-tsx.wasm',
    'typescript': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-typescript.wasm',
  };

async function main() {
  for (const lang of languages) {
    const url = wasmUrls[lang];
    const dest = path.join(outDir, `tree-sitter-${lang}.wasm`);
    console.log(`Downloading ${lang} WASM from ${url}...`);
    try {
      await downloadFile(url, dest);
      console.log(`Downloaded ${dest}`);
    } catch (err) {
      console.error(`Failed to download ${lang}:`, err);
      process.exit(1);
    }
  }
  process.exit(0);
}

main();