import OpenAI from 'openai';
import { getExtensionConfig } from '../utils/config';
import { logError, logWarn } from '../utils/logger';

export class LLMClient {
  private client: OpenAI;
  private model: string;
  private endpoint: string;

  constructor() {
    const config = getExtensionConfig();

    const isOpenRouter = config.apiEndpoint.includes('openrouter.ai');
    if (isOpenRouter && !config.openRouterApiKey) {
      logError(
        'OpenRouter API key not configured. Please set OPENROUTER_API_KEY environment variable or configure it in VS Code settings.'
      );
    }

    this.client = new OpenAI({
      apiKey: config.openRouterApiKey || 'not-needed-for-ollama',
      baseURL: config.apiEndpoint,
    });

    this.model = config.openRouterModel;
    this.endpoint = config.apiEndpoint;
  }

  /**
   * Send a completion request to the configured API endpoint with retry logic
   */
  async complete(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options: {
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
      maxRetries?: number;
    } = {
      //empty
    }
  ): Promise<string> {
    const maxRetries = options.maxRetries ?? 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          temperature: options.temperature ?? 0.1,
          max_tokens: options.maxTokens ?? 2000,
          response_format: options.jsonMode ? { type: 'json_object' } : undefined,
        });

        return response.choices[0]?.message?.content || '';
      } catch (error: any) {
        lastError = error;
        const endpointName = this.endpoint.includes('openrouter.ai')
          ? 'OpenRouter'
          : 'API endpoint';

        if (error.status === 401 || error.status === 400 || error.status === 404) {
          logError(`${endpointName} API error: ${error.message}`);
          return '';
        }

        if (attempt === maxRetries) {
          logError(`${endpointName} API error after ${maxRetries + 1} attempts: ${error.message}`);
          return '';
        }

        const delayMs = Math.pow(2, attempt) * 1000;
        logWarn(
          `LLM API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs}ms...: ${error.message}`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    logError(
      `${this.endpoint.includes('openrouter.ai') ? 'OpenRouter' : 'API endpoint'} API error: ${lastError?.message || 'Unknown error'}`
    );
    return '';
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.complete(
        [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        { maxTokens: 10 }
      );
      return true;
    } catch {
      return false;
    }
  }
}

let llmClient: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!llmClient) {
    llmClient = new LLMClient();
  }
  return llmClient;
}

export const getOpenRouterClient = getLLMClient;
export type OpenRouterClient = LLMClient;
