export type ModelProviderType = 
  | 'claude_cli'         // BYOS: Claude Code CLI session
  | 'codex_cli'          // BYOS: ChatGPT Plus/Team via Codex CLI session
  | 'ollama'             // Local-first zero-cost models (qwen2.5-coder, llama3.3)
  | 'gemini_api'         // Google Gemini 2.5/1.5 API
  | 'openai_compatible'; // OpenRouter, Groq, DeepSeek, LocalAI

export interface ModelProviderConfig {
  id: string;
  type: ModelProviderType;
  name: string;
  isAvailable: boolean;
  endpoint?: string;
  apiKey?: string;
  cliPath?: string;
  supportedModels: string[];
  activeModel: string;
  isSubscriptionBridge: boolean;
}

export interface ModelCompletionRequest {
  systemPrompt: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    senderName?: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>;
}

export interface ModelCompletionResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    toolName: string;
    arguments: Record<string, any>;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
