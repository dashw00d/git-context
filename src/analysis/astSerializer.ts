import { getTreeSitterParser } from './tree-sitter';
import { detectLanguage } from '../utils/config';

export interface SerializedNode {
    type: string;
    text?: string;
    range: [number, number]; // start line, end line
    children?: SerializedNode[];
}

export class AstSerializer {
    private parser = getTreeSitterParser();

    /**
     * Parse file content and return a serialized JSON representation of the AST
     * tailored for LLM consumption (compact, truncated text)
     */
    async serializeFile(content: string, filePath: string, maxDepth: number = 5): Promise<SerializedNode | null> {
        const language = detectLanguage(filePath);
        if (!language) return null;

        try {
            return await this.parser.serializeFile(content, language, maxDepth);
        } catch (error) {
            console.error(`Error serializing file ${filePath}:`, error);
            return null;
        }
    }
}
