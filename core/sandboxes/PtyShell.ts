import { spawn } from 'node:child_process';
import { AgentId } from '../types/agent.ts';
import { WorkspaceManager } from './WorkspaceManager.ts';

export interface CommandExecutionResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export class PtyShell {
  private workspaceManager: WorkspaceManager;

  constructor(workspaceManager: WorkspaceManager) {
    this.workspaceManager = workspaceManager;
  }

  public async executeCommand(
    agentId: AgentId,
    command: string,
    timeoutMs: number = 30000,
    onOutputChunk?: (chunk: string) => void
  ): Promise<CommandExecutionResult> {
    const cwd = this.workspaceManager.getWorkspacePath(agentId);
    const start = Date.now();

    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'powershell.exe' : '/bin/bash';
      const args = isWindows ? ['-NoProfile', '-Command', command] : ['-c', command];

      let stdout = '';
      let stderr = '';

      const child = spawn(shell, args, {
        cwd,
        env: {
          ...process.env,
          GRABBOTS_BOT_ID: agentId,
          GRABBOTS_WORKSPACE: cwd,
        },
      });

      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
      }, timeoutMs);

      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        if (onOutputChunk) onOutputChunk(text);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        if (onOutputChunk) onOutputChunk(text);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          command,
          exitCode: code ?? 0,
          stdout,
          stderr,
          durationMs: Date.now() - start,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
