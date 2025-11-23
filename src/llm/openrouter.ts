import OpenAI from 'openai';
import { getExtensionConfig } from '../utils/config';

export class LLMClient {
  private client: OpenAI;
  private model: string;
  private endpoint: string;

  constructor() {
    const config = getExtensionConfig();

    // Check if API key is required (OpenRouter needs it, Ollama doesn't)
    const isOpenRouter = config.apiEndpoint.includes('openrouter.ai');
    if (isOpenRouter && !config.openRouterApiKey) {
      throw new Error('OpenRouter API key not configured. Please set OPENROUTER_API_KEY environment variable or configure it in VS Code settings.');
    }

    this.client = new OpenAI({
      apiKey: config.openRouterApiKey || 'not-needed-for-ollama', // Ollama doesn't need API keys
      baseURL: config.apiEndpoint
    });

    this.model = config.openRouterModel;
    this.endpoint = config.apiEndpoint;
  }

  /**
   * Send a completion request to the configured API endpoint
   */
  async complete(messages: OpenAI.Chat.ChatCompletionMessageParam[], options: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  } = {}): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens ?? 2000,
        response_format: options.jsonMode ? { type: 'json_object' } : undefined
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      const endpointName = this.endpoint.includes('openrouter.ai') ? 'OpenRouter' : 'API endpoint';
      throw new Error(`${endpointName} API error: ${error.message}`);
    }
  }

  /**
   * Check if the client is properly configured
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.complete([{
        role: 'user',
        content: 'Hello'
      }], { maxTokens: 10 });
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let llmClient: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!llmClient) {
    llmClient = new LLMClient();
  }
  return llmClient;
}

// Backward compatibility
export const getOpenRouterClient = getLLMClient;
export type OpenRouterClient = LLMClient;
