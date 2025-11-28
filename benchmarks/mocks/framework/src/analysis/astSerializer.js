"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstSerializer = void 0;
const tree_sitter_1 = require("./tree-sitter");
const config_1 = require("../utils/config");
class AstSerializer {
    constructor() {
        this.parser = (0, tree_sitter_1.getTreeSitterParser)();
    }
    /**
     * Parse file content and return a serialized JSON representation of the AST
     * tailored for LLM consumption (compact, truncated text)
     */
    async serializeFile(content, filePath, maxDepth = 5) {
        const language = (0, config_1.detectLanguage)(filePath);
        if (!language)
            return null;
        const tree = await this.parser.parseFile(content, language);
        if (!tree)
            return null;
        return this.serializeNode(tree.rootNode, maxDepth);
    }
    serializeNode(node, depth) {
        const serialized = {
            type: node.type,
            range: [node.startPosition.row + 1, node.endPosition.row + 1]
        };
        // Include text for leaf nodes or specific interesting nodes
        // Truncate to avoid exploding token count
        if (node.childCount === 0 || this.isInterestingNode(node.type)) {
            const text = node.text;
            if (text.length > 200) {
                serialized.text = text.substring(0, 200) + '...';
            }
            else {
                serialized.text = text;
            }
        }
        // Recurse for children if within depth limit
        if (depth > 0 && node.childCount > 0) {
            const children = [];
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
    isInterestingNode(type) {
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
exports.AstSerializer = AstSerializer;
