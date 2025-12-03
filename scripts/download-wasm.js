const fs = require('fs');
const path = require('path');
const https = require('https');



let languages, wasmUrls, getRequiredLanguagesForExtensions;
try {
  const supportedLanguagesPath = path.join(__dirname, '..', 'out', 'utils', 'supportedLanguages.js');
  if (!fs.existsSync(supportedLanguagesPath)) {
    throw new Error(`Compiled TypeScript file not found at ${supportedLanguagesPath}. Run 'tsc' first.`);
  }

  const resolvedPath = require.resolve(supportedLanguagesPath);
  if (require.cache[resolvedPath]) {
    delete require.cache[resolvedPath];
  }
  const { SUPPORTED_LANGUAGES, WASM_URLS, getRequiredLanguagesForExtensions: getRequiredLangs } = require(supportedLanguagesPath);
  languages = SUPPORTED_LANGUAGES;
  wasmUrls = WASM_URLS;
  getRequiredLanguagesForExtensions = getRequiredLangs;
  console.log(`Loaded ${languages.length} languages from TypeScript source`);
} catch (err) {
  console.error('Failed to load supportedLanguages from compiled output:', err.message);
  console.error('Falling back to hardcoded values. Make sure to run "tsc" before this script.');

  languages = ['typescript', 'javascript', 'php'];
  wasmUrls = {
    'javascript': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-javascript.wasm',
    'php': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-php.wasm',
    'typescript': 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-typescript.wasm'
  };
  getRequiredLanguagesForExtensions = null;
}


function getUserConfiguredExtensions() {

  const vscodeConfigPath = path.join(__dirname, '..', '.vscode', 'settings.json');
  if (fs.existsSync(vscodeConfigPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(vscodeConfigPath, 'utf8'));
      if (config['git-context.allowedExtensions']) {
        return config['git-context.allowedExtensions'];
      }
    } catch (err) {

    }
  }


  const workspaceConfigPath = path.join(__dirname, '..', '.git-context.config.json');
  if (fs.existsSync(workspaceConfigPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(workspaceConfigPath, 'utf8'));
      if (config.allowedExtensions) {
        return config.allowedExtensions;
      }
    } catch (err) {

    }
  }

  return null;
}


const outDir = path.join(__dirname, '..', 'out', 'wasm');
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

          if (percent - lastLogged >= 10) {
            console.log(`${path.basename(dest)}: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB)`);
            lastLogged = percent;
          }
        } else {

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

async function main() {

  let languagesToDownload = languages;


  const userExtensions = getUserConfiguredExtensions();
  if (userExtensions && getRequiredLanguagesForExtensions) {
    console.log(`User configured extensions: ${userExtensions.join(', ')}`);
    const requiredLangs = getRequiredLanguagesForExtensions(userExtensions);
    console.log(`Required languages: ${requiredLangs.join(', ')}`);



    languagesToDownload = requiredLangs.filter(lang => {
      const dest = path.join(outDir, `tree-sitter-${lang}.wasm`);
      const oldDest = path.join(__dirname, '..', 'out', `tree-sitter-${lang}.wasm`);
      return !fs.existsSync(dest) && !fs.existsSync(oldDest);
    });

    if (languagesToDownload.length === 0) {
      console.log('All required WASM files already exist. Skipping download.');
      process.exit(0);
    }

    console.log(`Downloading ${languagesToDownload.length} missing WASM file(s)...`);
  } else {


    languagesToDownload = languages.filter(lang => {
      const dest = path.join(outDir, `tree-sitter-${lang}.wasm`);
      const oldDest = path.join(__dirname, '..', 'out', `tree-sitter-${lang}.wasm`);
      return !fs.existsSync(dest) && !fs.existsSync(oldDest);
    });

    if (languagesToDownload.length === 0) {
      console.log('All WASM files already exist. Use --force to re-download.');
      process.exit(0);
    }

    console.log(`Downloading ${languagesToDownload.length} missing WASM file(s) out of ${languages.length} total...`);
  }


  for (const lang of languagesToDownload) {
    const url = wasmUrls[lang];
    if (!url) {
      console.warn(`No WASM URL found for language: ${lang}. Skipping.`);
      continue;
    }

    const dest = path.join(outDir, `tree-sitter-${lang}.wasm`);
    console.log(`Downloading ${lang} WASM from ${url}...`);
    try {
      await downloadFile(url, dest);
      console.log(`Downloaded ${dest}`);
    } catch (err) {
      console.error(`Failed to download ${lang}:`, err);

    }
  }

  console.log('Download complete!');
  process.exit(0);
}

main();
