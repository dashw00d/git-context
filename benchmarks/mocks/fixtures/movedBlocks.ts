/**
 * Moved block fixture samples for testing moved block detection
 */

export interface MovedBlockFixture {
  name: string;
  deletedSymbols: Array<{
    id: string;
    name: string;
    filePath: string;
    content: string;
  }>;
  addedSymbols: Array<{
    id: string;
    name: string;
    filePath: string;
    content: string;
  }>;
  expectedMetrics: {
    totalMovedBlocks: number;
    fileRenames: number;
    blockMoves: number;
    symbolRenames: number;
    averageSimilarity: number;
    movedSymbols: number;
    movedLines: number;
  };
}

/**
 * Sample moved block scenarios for testing
 */
export const movedBlockFixtures: MovedBlockFixture[] = [
  {
    name: 'file_rename_scenario',
    deletedSymbols: [
      {
        id: 'src/oldName.ts:UserService',
        name: 'UserService',
        filePath: 'src/oldName.ts',
        content: `export class UserService {
  getUser(id: string) {
    return this.db.find(id);
  }
}`
      }
    ],
    addedSymbols: [
      {
        id: 'src/newName.ts:UserService',
        name: 'UserService',
        filePath: 'src/newName.ts',
        content: `export class UserService {
  getUser(id: string) {
    return this.db.find(id);
  }
}`
      }
    ],
    expectedMetrics: {
      totalMovedBlocks: 1,
      fileRenames: 1,
      blockMoves: 0,
      symbolRenames: 0,
      averageSimilarity: 1.0,
      movedSymbols: 1,
      movedLines: 5
    }
  },
  {
    name: 'block_move_scenario',
    deletedSymbols: [
      {
        id: 'src/utils.ts:validateEmail',
        name: 'validateEmail',
        filePath: 'src/utils.ts',
        content: `function validateEmail(email: string): boolean {
  const regex = /^[^@]+@[^@]+\.[^@]+$/;
  return regex.test(email);
}`
      }
    ],
    addedSymbols: [
      {
        id: 'src/userValidators.ts:validateEmail',
        name: 'validateEmail',
        filePath: 'src/userValidators.ts',
        content: `function validateEmail(email: string): boolean {
  const regex = /^[^@]+@[^@]+\.[^@]+$/;
  return regex.test(email);
}`
      }
    ],
    expectedMetrics: {
      totalMovedBlocks: 1,
      fileRenames: 0,
      blockMoves: 1,
      symbolRenames: 0,
      averageSimilarity: 1.0,
      movedSymbols: 1,
      movedLines: 4
    }
  },
  {
    name: 'symbol_rename_scenario',
    deletedSymbols: [
      {
        id: 'src/api.ts:getUserData',
        name: 'getUserData',
        filePath: 'src/api.ts',
        content: `function getUserData(id: string) {
  return fetch(\`/api/users/\${id}\`);
}`
      }
    ],
    addedSymbols: [
      {
        id: 'src/api.ts:fetchUserById',
        name: 'fetchUserById',
        filePath: 'src/api.ts',
        content: `function fetchUserById(id: string) {
  return fetch(\`/api/users/\${id}\`);
}`
      }
    ],
    expectedMetrics: {
      totalMovedBlocks: 1,
      fileRenames: 0,
      blockMoves: 0,
      symbolRenames: 1,
      averageSimilarity: 1.0,
      movedSymbols: 1,
      movedLines: 3
    }
  }
];
