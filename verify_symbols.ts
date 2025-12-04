
import { ExplorerService } from './src/services/explorerService';
import { RefactorBundleFacts } from './src/facts/types';

// Mock bundle facts with the structure we suspect might be causing issues
const mockBundleFacts: RefactorBundleFacts = {
  version: '2.0',
  generated_at: new Date().toISOString(),
  confidence: 1,
  bundle: {
    oldestSha: 'abc',
    shas: ['abc'],
  },
  scope: {
    files: 1,
    blastRadius: 0,
  },
  intended: { present: 1, absent: 0, renamed: 0 },
  working: { symbols: 1, edges: 0 }, // This is a number in the type definition!
  findings: {
    incompleteness: { missing: 0, zombies: 0, divergent: 0 },
    patternDrift: { mixedTargets: 0, oldNamespaces: 0 },
    legacyAudit: { dead: 0, legacyUsed: 0, replacedLeftovers: [] },
  },
  evidence: {
    'scope.files': ['src/test.ts'],
    // The ExplorerService expects this to be an array of strings "path:name:id"
    // But the type definition says working.symbols is a number (in the main object)
    // We need to check what's in evidence['working.symbols']
    'working.symbols': ['src/test.ts:TestSymbol:123'], 
  },
};

async function run() {
  console.log('Testing ExplorerService symbol hydration...');
  
  const service = ExplorerService.getInstance();
  const nodes = service.getExplorerTree(mockBundleFacts, null, [], null);
  
  console.log('Explorer Tree Nodes:');
  console.log(JSON.stringify(nodes, null, 2));
  
  // Check if symbols were hydrated
  const root = nodes.find(n => n.id === 'bundle-root');
  const src = root?.children?.find(n => n.name === 'src');
  const file = src?.children?.find(n => n.name === 'test.ts');
  
  if (file?.children?.length) {
    console.log('SUCCESS: Symbols hydrated correctly.');
    console.log('Symbols:', file.children);
  } else {
    console.log('FAILURE: No symbols found in file node.');
  }
}

run().catch(console.error);
