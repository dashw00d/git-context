import { TreeSitterParser } from './src/analysis/tree-sitter';

async function testTypeScript() {
  console.log('Testing TypeScript parsing...');
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

  console.log('Content to parse:', content.substring(0, 50) + '...');

  try {
    console.log('Calling extractHybridFacts...');
    const start = Date.now();
    const result = await parser.extractHybridFacts(content, '/tmp/test.ts', 'typescript');
    const end = Date.now();
    console.log(`Parsing completed in ${end - start}ms`);
    console.log('Symbols found:', result.length);
    result.forEach((s: any) => console.log(`  ${s.name} (${s.kind})`));
  } catch (error) {
    console.error('TypeScript parsing failed:', error);
  }
}

testTypeScript().catch(console.error);
