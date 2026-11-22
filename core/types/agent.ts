export type AgentId = 'chief' | 'dev' | 'research' | 'design' | 'review' | string;

export type AgentRole = 
  | 'Chief of Staff' 
  | 'Full-Stack Engineer' 
  | 'Deep Researcher' 
  | 'UI/UX Designer' 
  | 'QA & Code Reviewer';

export type AgentStatus = 'idle' | 'thinking' | 'executing_tool' | 'awaiting_approval' | 'error';

export interface AgentDefinition {
  id: AgentId;
  name: string;
  role: AgentRole;
  avatar: string;
  color: string;
  description: string;
  systemPrompt: string;
  workspacePath: string;
  toolsAllowed: string[];
  preferredModel: string;
}

export interface ToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  isError?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: AgentId | 'user';
  senderName: string;
  senderRole?: AgentRole;
  recipientId?: AgentId | 'all';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  approvalRequestId?: string;
  metadata?: Record<string, any>;
}

export interface BotWorkspaceInfo {
  agentId: AgentId;
  directory: string;
  activeProcesses: number;
  openFiles: string[];
}
