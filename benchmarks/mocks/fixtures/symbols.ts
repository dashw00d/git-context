/**
 * Symbol Fixtures for Metric Testing
 *
 * Reusable symbol test data builders
 */

import { MockSymbol } from '../dataFactory';

export class SymbolFixtures {

  static added(id: string, type: MockSymbol['type'], options: Partial<MockSymbol> = {}): MockSymbol {
    return {
      id,
      type,
      status: 'added',
      filePath: options.filePath,
      lineNumber: options.lineNumber,
      blastRadius: options.blastRadius || 1
    };
  }

  static modified(id: string, type: MockSymbol['type'], options: Partial<MockSymbol> = {}): MockSymbol {
    return {
      id,
      type,
      status: 'modified',
      filePath: options.filePath,
      lineNumber: options.lineNumber,
      blastRadius: options.blastRadius || 1
    };
  }

  static removed(id: string, type: MockSymbol['type'], options: Partial<MockSymbol> = {}): MockSymbol {
    return {
      id,
      type,
      status: 'removed',
      filePath: options.filePath,
      lineNumber: options.lineNumber,
      blastRadius: options.blastRadius || 1
    };
  }

  // Domain-specific helpers
  static authFunction(name: string, version = 'V1'): MockSymbol {
    return this.added(`Auth${version}.${name}`, 'method', {
      filePath: `src/auth/Auth${version}.ts`,
      blastRadius: version === 'V1' ? 8 : 12
    });
  }

  static controllerMethod(controller: string, method: string): MockSymbol {
    return this.added(`${controller}.${method}`, 'method', {
      filePath: `src/controllers/${controller}.ts`,
      blastRadius: 5
    });
  }

  static serviceMethod(service: string, method: string): MockSymbol {
    return this.added(`${service}.${method}`, 'method', {
      filePath: `src/services/${service}.ts`,
      blastRadius: 8
    });
  }

  static validatorFunction(name: string): MockSymbol {
    return this.added(`${name}`, 'function', {
      filePath: 'src/validation/validators.ts',
      blastRadius: 3
    });
  }

  static classDefinition(name: string, filePath?: string): MockSymbol {
    return this.added(name, 'class', {
      filePath: filePath || `src/${name}.ts`,
      blastRadius: 10
    });
  }

  static interfaceDefinition(name: string): MockSymbol {
    return this.added(name, 'interface', {
      filePath: `src/types/${name}.ts`,
      blastRadius: 15
    });
  }

  // Test-specific symbols
  static zombie(name: string): MockSymbol {
    return this.modified(name, 'method', {
      filePath: 'src/legacy.ts',
      blastRadius: 5
    });
  }

  static missingDependency(name: string): MockSymbol {
    // This represents a symbol that is referenced but doesn't exist
    return {
      id: name,
      type: 'method',
      status: 'added',
      blastRadius: 0 // Missing symbols have no blast radius
    };
  }
}
