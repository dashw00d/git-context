import OpenAI from 'openai';
export declare class LLMClient {
    private client;
    private model;
    private endpoint;
    constructor();
    /**
     * Send a completion request to the configured API endpoint
     */
    complete(messages: OpenAI.Chat.ChatCompletionMessageParam[], options?: {
        temperature?: number;
        maxTokens?: number;
        jsonMode?: boolean;
    }): Promise<string>;
    /**
     * Check if the client is properly configured
     */
    validateConnection(): Promise<boolean>;
}
export declare function getLLMClient(): LLMClient;
export declare const getOpenRouterClient: typeof getLLMClient;
export type OpenRouterClient = LLMClient;
//# sourceMappingURL=openrouter.d.ts.map