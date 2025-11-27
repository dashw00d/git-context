/**
 * Golden difftastic output fixtures for testing structural diff parsing
 */

export interface DifftasticFixture {
  name: string;
  oldContent: string;
  newContent: string;
  expectedOutput: string;
  expectedMetrics: {
    linesAdded: number;
    linesRemoved: number;
    controlFlowChanged: boolean;
    interfaceChanged: boolean;
    structuralChangeScore: number;
  };
}

/**
 * Sample difftastic output with hunks and control-flow changes
 */
export const difftasticFixtures: DifftasticFixture[] = [
  {
    name: 'simple_function_addition',
    oldContent: `function existing() {
  return true;
}`,
    newContent: `function existing() {
  return true;
}

function newFunction() {
  if (condition) {
    return false;
  }
  return true;
}`,
    expectedOutput: `File src/example.ts
@@ -1,3 +1,10 @@
 function existing() {
   return true;
 }
+
+function newFunction() {
+  if (condition) {
+    return false;
+  }
+  return true;
+}`,
    expectedMetrics: {
      linesAdded: 8,
      linesRemoved: 0,
      controlFlowChanged: true, // if statement added
      interfaceChanged: true,   // function added
      structuralChangeScore: 0.8 // 8/10 = 0.8
    }
  },
  {
    name: 'class_modification_with_interface',
    oldContent: `class UserService {
  getUser(id: string) {
    return this.db.find(id);
  }
}`,
    newContent: `export class UserService {
  constructor(private db: Database) {}

  async getUser(id: string): Promise<User> {
    const user = await this.db.find(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
}`,
    expectedOutput: `File src/userService.ts
@@ -1,5 +1,12 @@
-export class UserService {
-  constructor(private db: Database) {}
+class UserService {
+  getUser(id: string) {
+    return this.db.find(id);
+  }
+}

+function newFunction() {
+  if (condition) {
+    return false;
+  }
+  return true;
+}`,
    expectedMetrics: {
      linesAdded: 7,
      linesRemoved: 1,
      controlFlowChanged: true, // if/throw added
      interfaceChanged: true,   // constructor, export, async added
      structuralChangeScore: 0.8 // 8/10 = 0.8
    }
  }
];
