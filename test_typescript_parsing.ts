import { TreeSitterParser } from './src/analysis/tree-sitter';

async function testTypeScriptParsing() {
  const parser = new TreeSitterParser();
  await parser.initializeParsers();

  const content = `
export interface MathResult {
  value: number;
  operation: string;
}

export function add(a: number, b: number): MathResult {
  return { value: a + b, operation: 'add' };
}
`;

  try {
    const result = await parser.extractHybridFacts(content, '/tmp/test.ts', 'typescript');
    console.log('TypeScript parsing result:', result);
    console.log('Symbols found:', result.length);
    result.forEach((s: any) => console.log(`  ${s.name} (${s.kind})`));
  } catch (error) {
    console.error('TypeScript parsing failed:', error);
  }
}

testTypeScriptParsing().catch(console.error);
