"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenRouterClient = exports.getLLMClient = exports.LLMClient = void 0;
const openai_1 = __importDefault(require("openai"));
const config_1 = require("../utils/config");
class LLMClient {
    constructor() {
        const config = (0, config_1.getExtensionConfig)();
        // Check if API key is required (OpenRouter needs it, Ollama doesn't)
        const isOpenRouter = config.apiEndpoint.includes('openrouter.ai');
        if (isOpenRouter && !config.openRouterApiKey) {
            throw new Error('OpenRouter API key not configured. Please set OPENROUTER_API_KEY environment variable or configure it in VS Code settings.');
        }
        this.client = new openai_1.default({
            apiKey: config.openRouterApiKey || 'not-needed-for-ollama',
            baseURL: config.apiEndpoint
        });
        this.model = config.openRouterModel;
        this.endpoint = config.apiEndpoint;
    }
    /**
     * Send a completion request to the configured API endpoint
     */
    async complete(messages, options = {}) {
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages,
                temperature: options.temperature ?? 0.1,
                max_tokens: options.maxTokens ?? 2000,
                response_format: options.jsonMode ? { type: 'json_object' } : undefined
            });
            return response.choices[0]?.message?.content || '';
        }
        catch (error) {
            const endpointName = this.endpoint.includes('openrouter.ai') ? 'OpenRouter' : 'API endpoint';
            throw new Error(`${endpointName} API error: ${error.message}`);
        }
    }
    /**
     * Check if the client is properly configured
     */
    async validateConnection() {
        try {
            await this.complete([{
                    role: 'user',
                    content: 'Hello'
                }], { maxTokens: 10 });
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.LLMClient = LLMClient;
// Singleton instance
let llmClient = null;
function getLLMClient() {
    if (!llmClient) {
        llmClient = new LLMClient();
    }
    return llmClient;
}
exports.getLLMClient = getLLMClient;
// Backward compatibility
exports.getOpenRouterClient = getLLMClient;
//# sourceMappingURL=openrouter.js.map