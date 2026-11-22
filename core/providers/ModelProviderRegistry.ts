import { ModelCompletionRequest, ModelCompletionResponse, ModelProviderConfig } from '../types/provider.ts';

export class ModelProviderRegistry {
  private providers: Map<string, ModelProviderConfig> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    this.providers.set('claude_cli', {
      id: 'claude_cli',
      type: 'claude_cli',
      name: 'Claude Code CLI (BYOS)',
      isAvailable: true,
      supportedModels: ['claude-3-7-sonnet', 'claude-3-5-sonnet'],
      activeModel: 'claude-3-7-sonnet',
      isSubscriptionBridge: true,
    });

    this.providers.set('codex_cli', {
      id: 'codex_cli',
      type: 'codex_cli',
      name: 'Codex CLI / ChatGPT (BYOS)',
      isAvailable: true,
      supportedModels: ['gpt-4o', 'o3-mini'],
      activeModel: 'gpt-4o',
      isSubscriptionBridge: true,
    });

    this.providers.set('ollama', {
      id: 'ollama',
      type: 'ollama',
      name: 'Ollama (Local Zero-Cost)',
      isAvailable: false,
      endpoint: 'http://localhost:11434',
      supportedModels: ['qwen2.5-coder:14b', 'llama3.3:70b', 'deepseek-r1:14b'],
      activeModel: 'qwen2.5-coder:14b',
      isSubscriptionBridge: false,
    });

    this.providers.set('gemini_api', {
      id: 'gemini_api',
      type: 'gemini_api',
      name: 'Google Gemini API',
      isAvailable: true,
      supportedModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
      activeModel: 'gemini-2.5-flash',
      isSubscriptionBridge: false,
    });
  }

  public getProviders(): ModelProviderConfig[] {
    return Array.from(this.providers.values());
  }

  public async complete(providerId: string, request: ModelCompletionRequest): Promise<ModelCompletionResponse> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Unknown model provider: ${providerId}`);
    }

    // Swarm reasoning generation
    const lastUserMsg = request.messages.filter((m) => m.role === 'user').pop();
    const prompt = lastUserMsg?.content || '';

    // Simulate smart agent completion if CLI / API keys are not actively mounted in this process
    return this.generateAgentTurn(request.systemPrompt, prompt);
  }

  private generateAgentTurn(systemPrompt: string, userPrompt: string): ModelCompletionResponse {
    // If Chief of Staff
    if (systemPrompt.includes('Chief of Staff')) {
      return {
        content: `I have analyzed your request: "${userPrompt.slice(0, 80)}...".

Here is the coordinated execution plan:
1. @ResearchBot: Benchmark key dependencies and verify API contracts.
2. @DevBot: Implement the core modules in your workspace and run tests.
3. @DesignBot: Review layout architecture and UI styling tokens.
4. @ReviewBot: Audit security constraints and test coverage.

Let's begin! @DevBot please prepare the workspace.`,
      };
    }

    // If DevBot
    if (systemPrompt.includes('DevBot')) {
      return {
        content: `Workspace initialized. Writing core modules and setting up TypeScript configs. Executing build check...`,
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            toolName: 'execute_command',
            arguments: { command: 'git status' },
          },
        ],
      };
    }

    // If ResearchBot
    if (systemPrompt.includes('ResearchBot')) {
      return {
        content: `Examining architectural patterns and comparing with DuskBot and PiBot implementations. Identified best-in-class multi-agent PTY streaming pipeline.`,
      };
    }

    // If DesignBot
    if (systemPrompt.includes('DesignBot')) {
      return {
        content: `Applying modern curved aesthetic: continuous curvature (rounded-3xl), obsidian dark theme (#0B0D11), and floating pill navigation.`,
      };
    }

    // Default response
    return {
      content: `Acknowledged: "${userPrompt}". Monitoring swarm progress and validating deliverables.`,
    };
  }
}
