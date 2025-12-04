import { getDifftasticIntegration } from '../../src/analysis/difftastic';
import * as fs from 'fs';
import * as path from 'path';

describe('DifftasticIntegration with JSON output', () => {
  const tempDir = path.join(__dirname, 'temp_test_files');
  const oldFilePath = path.join(tempDir, 'old.txt');
  const newFilePath = path.join(tempDir, 'new.txt');

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    fs.writeFileSync(oldFilePath, 'function oldFunction() {\n  console.log("hello");\n}');
    fs.writeFileSync(newFilePath, 'function newFunction() {\n  console.log("world");\n}');
  });

  afterAll(() => {
    fs.unlinkSync(oldFilePath);
    fs.unlinkSync(newFilePath);
    fs.rmdirSync(tempDir);
  });

  it('should return raw JSON output from difftastic', async () => {
    const difftastic = getDifftasticIntegration();
    if (!difftastic.isAvailable()) {
      console.warn('Difftastic binary not available, skipping test.');
      return;
    }

    const result = await difftastic.runDifftastic(
      fs.readFileSync(oldFilePath, 'utf-8'),
      fs.readFileSync(newFilePath, 'utf-8'),
      oldFilePath,
      newFilePath
    );

    console.log('Difftastic JSON Output:', JSON.stringify(result.rawJson, null, 2));

    expect(result).toBeDefined();
    expect(result.rawJson).toBeInstanceOf(Array);
    expect(result.rawJson.length).toBeGreaterThan(0);
  });
});
