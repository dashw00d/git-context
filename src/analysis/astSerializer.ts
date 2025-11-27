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

        const tree = await this.parser.parseFile(content, language);
        if (!tree) return null;

        return this.serializeNode(tree.rootNode, maxDepth);
    }

    private serializeNode(node: any, depth: number): SerializedNode {
        const serialized: SerializedNode = {
            type: node.type,
            range: [node.startPosition.row + 1, node.endPosition.row + 1]
        };

        // Include text for leaf nodes or specific interesting nodes
        // Truncate to avoid exploding token count
        if (node.childCount === 0 || this.isInterestingNode(node.type)) {
            const text = node.text;
            if (text.length > 200) {
                serialized.text = text.substring(0, 200) + '...';
            } else {
                serialized.text = text;
            }
        }

        // Recurse for children if within depth limit
        if (depth > 0 && node.childCount > 0) {
            const children: SerializedNode[] = [];
            // Use a cursor for efficient traversal
            // Note: web-tree-sitter node.children creates an array, which is fine for small trees
            // but for performance we might want to be careful. For now, node.children is easiest.
            for (const child of node.children) {
                // Skip unnamed nodes (punctuation, etc) to save tokens, unless they are critical
                if (child.isNamed) {
                    children.push(this.serializeNode(child, depth - 1));
                }
            }
            if (children.length > 0) {
                serialized.children = children;
            }
        }

        return serialized;
    }

    private isInterestingNode(type: string): boolean {
        // Nodes where we definitely want the text content
        return [
            'identifier',
            'string',
            'string_literal',
            'number',
            'integer',
            'property_identifier',
            'type_identifier',
            'variable_name',
            'method_name',
            'class_name'
        ].includes(type);
    }
}
