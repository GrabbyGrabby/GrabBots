import { AgentId } from './agent.ts';

export type RiskLevel = 'safe' | 'mutating' | 'destructive';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'modified';

export interface ApprovalRequest {
  id: string;
  agentId: AgentId;
  agentName: string;
  toolName: string;
  riskLevel: RiskLevel;
  commandOrAction: string;
  targetPath?: string;
  proposedDiff?: string;
  description: string;
  status: ApprovalStatus;
  createdAt: string;
  resolvedAt?: string;
  modifiedInput?: Record<string, any>;
}

export interface ApprovalDecision {
  requestId: string;
  decision: 'approve' | 'reject' | 'modify';
  feedback?: string;
  modifiedInput?: Record<string, any>;
}
