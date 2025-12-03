import { detectLanguage } from '../utils/config';
import { logError } from '../utils/logger';
import { getTreeSitterParser } from './tree-sitter';

export interface SerializedNode {
  type: string;
  text?: string;
  range: [number, number];
  children?: SerializedNode[];
}

export class AstSerializer {
  private parser = getTreeSitterParser();

  async serializeFile(
    content: string,
    filePath: string,
    maxDepth: number = 5
  ): Promise<SerializedNode | null> {
    const language = detectLanguage(filePath);
    if (!language) return null;

    try {
      return await this.parser.serializeFile(content, language, maxDepth);
    } catch (error) {
      logError(`Error serializing file ${filePath}`, error);
      return null;
    }
  }
}
