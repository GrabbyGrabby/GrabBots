import { AgentId } from '../types/agent.ts';
import { ApprovalRequest, ApprovalStatus, RiskLevel } from '../types/approval.ts';

export class HitlApprovalGate {
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private approvalHistory: ApprovalRequest[] = [];
  private onApprovalRequiredCallback?: (request: ApprovalRequest) => void;

  public setOnApprovalRequired(callback: (request: ApprovalRequest) => void) {
    this.onApprovalRequiredCallback = callback;
  }

  public assessRisk(toolName: string, args: Record<string, any>): RiskLevel {
    if (toolName === 'execute_command') {
      const cmd = (args.command || '').toLowerCase();
      if (
        cmd.includes('rm -rf') ||
        cmd.includes('del /s') ||
        cmd.includes('drop ') ||
        cmd.includes('git push --force') ||
        cmd.includes('format ')
      ) {
        return 'destructive';
      }
      if (
        cmd.includes('git commit') ||
        cmd.includes('pnpm add') ||
        cmd.includes('npm install') ||
        cmd.includes('git checkout -b') ||
        cmd.includes('mkdir ') ||
        cmd.includes('mv ')
      ) {
        return 'mutating';
      }
      return 'safe';
    }

    if (toolName === 'write_file' || toolName === 'delete_file') {
      return toolName === 'delete_file' ? 'destructive' : 'mutating';
    }

    return 'safe';
  }

  public requestApproval(
    agentId: AgentId,
    agentName: string,
    toolName: string,
    args: Record<string, any>,
    proposedDiff?: string
  ): Promise<boolean> {
    const riskLevel = this.assessRisk(toolName, args);

    // If completely safe, auto-approve immediately
    if (riskLevel === 'safe') {
      return Promise.resolve(true);
    }

    const requestId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const request: ApprovalRequest = {
      id: requestId,
      agentId,
      agentName,
      toolName,
      riskLevel,
      commandOrAction: args.command || `${toolName}(${JSON.stringify(args)})`,
      targetPath: args.path || args.relativePath,
      proposedDiff,
      description: `${agentName} wants to run ${toolName}: ${args.command || JSON.stringify(args)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.pendingApprovals.set(requestId, request);

    if (this.onApprovalRequiredCallback) {
      this.onApprovalRequiredCallback(request);
    }

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const current = this.pendingApprovals.get(requestId);
        if (!current || current.status !== 'pending') {
          clearInterval(checkInterval);
          if (current && (current.status === 'approved' || current.status === 'modified')) {
            resolve(true);
          } else {
            resolve(false);
          }
        }
      }, 500);
    });
  }

  public resolveApproval(requestId: string, decision: 'approve' | 'reject' | 'modify', modifiedInput?: Record<string, any>) {
    const request = this.pendingApprovals.get(requestId);
    if (!request) return false;

    request.status = decision === 'approve' ? 'approved' : decision === 'modify' ? 'modified' : 'rejected';
    request.resolvedAt = new Date().toISOString();
    request.modifiedInput = modifiedInput;

    this.pendingApprovals.delete(requestId);
    this.approvalHistory.push(request);
    return true;
  }

  public getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  public getHistory(): ApprovalRequest[] {
    return this.approvalHistory;
  }
}
