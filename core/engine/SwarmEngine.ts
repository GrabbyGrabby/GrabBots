import { AgentDefinition, AgentId, ChatMessage, ToolCall } from '../types/agent.ts';
import { DEFAULT_BOT_ROSTER } from '../agents/AgentRoster.ts';
import { WorkspaceManager } from '../sandboxes/WorkspaceManager.ts';
import { PtyShell } from '../sandboxes/PtyShell.ts';
import { HitlApprovalGate } from '../policy/HitlApprovalGate.ts';
import { ModelProviderRegistry } from '../providers/ModelProviderRegistry.ts';

export class SwarmEngine {
  private bots: Map<AgentId, AgentDefinition> = new Map();
  private messages: ChatMessage[] = [];
  private workspaceManager: WorkspaceManager;
  private ptyShell: PtyShell;
  private approvalGate: HitlApprovalGate;
  private modelRegistry: ModelProviderRegistry;
  private eventListeners: Array<(event: { type: string; payload: any }) => void> = [];

  constructor() {
    this.workspaceManager = new WorkspaceManager();
    this.ptyShell = new PtyShell(this.workspaceManager);
    this.approvalGate = new HitlApprovalGate();
    this.modelRegistry = new ModelProviderRegistry();

    // Register all default bots and initialize their isolated workspaces
    for (const bot of DEFAULT_BOT_ROSTER) {
      this.bots.set(bot.id, bot);
      this.workspaceManager.initBotWorkspace(bot.id);
    }

    // Forward approval events
    this.approvalGate.setOnApprovalRequired((request) => {
      this.broadcast('approval_required', request);
    });
  }

  public onEvent(listener: (event: { type: string; payload: any }) => void) {
    this.eventListeners.push(listener);
  }

  private broadcast(type: string, payload: any) {
    for (const listener of this.eventListeners) {
      listener({ type, payload });
    }
  }

  public getBots(): AgentDefinition[] {
    return Array.from(this.bots.values());
  }

  public getMessages(): ChatMessage[] {
    return this.messages;
  }

  public getApprovalGate(): HitlApprovalGate {
    return this.approvalGate;
  }

  public getWorkspaceManager(): WorkspaceManager {
    return this.workspaceManager;
  }

  public getPtyShell(): PtyShell {
    return this.ptyShell;
  }

  public async postUserMessage(content: string): Promise<ChatMessage> {
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      senderId: 'user',
      senderName: 'You',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    this.messages.push(userMsg);
    this.broadcast('new_message', userMsg);

    // Chief of Staff picks up the message and leads the swarm
    await this.triggerBotTurn('chief', content);

    return userMsg;
  }

  public async triggerBotTurn(agentId: AgentId, userContext: string): Promise<void> {
    const bot = this.bots.get(agentId);
    if (!bot) return;

    this.broadcast('bot_status', { agentId, status: 'thinking' });

    // Generate bot response using its preferred model provider
    const completion = await this.modelRegistry.complete(bot.preferredModel, {
      systemPrompt: bot.systemPrompt,
      messages: [
        { role: 'user', content: userContext }
      ],
    });

    const botMsg: ChatMessage = {
      id: `msg_${Date.now()}_${agentId}`,
      senderId: bot.id,
      senderName: bot.name,
      senderRole: bot.role,
      content: completion.content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      toolCalls: completion.toolCalls,
    };

    this.messages.push(botMsg);
    this.broadcast('new_message', botMsg);
    this.broadcast('bot_status', { agentId, status: 'idle' });

    // Check if tools were invoked
    if (completion.toolCalls && completion.toolCalls.length > 0) {
      for (const call of completion.toolCalls) {
        await this.handleToolCall(bot, call);
      }
    }

    // Check if other bots were tagged via @mentions (only Chief of Staff fans out to team)
    if (bot.id === 'chief') {
      await this.processMentions(botMsg.content);
    }
  }

  private async handleToolCall(bot: AgentDefinition, call: ToolCall): Promise<void> {
    this.broadcast('bot_status', { agentId: bot.id, status: 'executing_tool' });

    // Intercept with HITL Approval Gate if risky
    const approved = await this.approvalGate.requestApproval(
      bot.id,
      bot.name,
      call.toolName,
      call.arguments
    );

    let output = '';
    let isError = false;

    if (!approved) {
      output = `Tool execution rejected by user.`;
      isError = true;
    } else {
      try {
        if (call.toolName === 'execute_command') {
          const res = await this.ptyShell.executeCommand(bot.id, call.arguments.command);
          output = res.stdout || res.stderr || `(Process exited with code ${res.exitCode})`;
        } else if (call.toolName === 'write_file') {
          const filePath = this.workspaceManager.writeFile(
            bot.id,
            call.arguments.path,
            call.arguments.content
          );
          output = `Successfully created file at ${filePath}`;
        } else if (call.toolName === 'read_file') {
          output = this.workspaceManager.readFile(bot.id, call.arguments.path);
        } else {
          output = `Tool executed: ${call.toolName}`;
        }
      } catch (err: any) {
        output = `Error executing tool: ${err.message}`;
        isError = true;
      }
    }

    const toolResultMsg: ChatMessage = {
      id: `msg_${Date.now()}_tool_${bot.id}`,
      senderId: bot.id,
      senderName: bot.name,
      senderRole: bot.role,
      content: `\`\`\`bash\n$ ${call.arguments.command || call.toolName}\n${output}\n\`\`\``,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      toolResults: [
        {
          toolCallId: call.id,
          output,
          isError,
        },
      ],
    };

    this.messages.push(toolResultMsg);
    this.broadcast('new_message', toolResultMsg);
    this.broadcast('bot_status', { agentId: bot.id, status: 'idle' });
  }

  private async processMentions(text: string) {
    if (text.includes('@DevBot')) {
      setTimeout(() => this.triggerBotTurn('dev', text), 1200);
    }
    if (text.includes('@ResearchBot')) {
      setTimeout(() => this.triggerBotTurn('research', text), 1800);
    }
    if (text.includes('@DesignBot')) {
      setTimeout(() => this.triggerBotTurn('design', text), 2400);
    }
    if (text.includes('@ReviewBot')) {
      setTimeout(() => this.triggerBotTurn('review', text), 3000);
    }
  }
}
