import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AgentId, BotWorkspaceInfo } from '../types/agent.ts';

export class WorkspaceManager {
  private baseDir: string;
  private botWorkspaces: Map<AgentId, string> = new Map();

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.join(os.homedir(), '.grabbots', 'workspaces');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public initBotWorkspace(agentId: AgentId): string {
    const botDir = path.join(this.baseDir, agentId);
    if (!fs.existsSync(botDir)) {
      fs.mkdirSync(botDir, { recursive: true });
      fs.mkdirSync(path.join(botDir, 'scratch'), { recursive: true });
      fs.mkdirSync(path.join(botDir, 'output'), { recursive: true });
      
      // Initialize an isolated bot README
      const readmePath = path.join(botDir, 'WORKSPACE.md');
      fs.writeFileSync(
        readmePath,
        `# Workspace for Bot [${agentId}]\nIsolated virtual computer environment initialized: ${new Date().toISOString()}\n`
      );
    }
    this.botWorkspaces.set(agentId, botDir);
    return botDir;
  }

  public getWorkspacePath(agentId: AgentId): string {
    let ws = this.botWorkspaces.get(agentId);
    if (!ws) {
      ws = this.initBotWorkspace(agentId);
    }
    return ws;
  }

  public listFiles(agentId: AgentId, subPath: string = ''): string[] {
    const ws = this.getWorkspacePath(agentId);
    const targetDir = path.join(ws, subPath);
    if (!fs.existsSync(targetDir)) return [];
    
    return fs.readdirSync(targetDir, { recursive: true }) as string[];
  }

  public readFile(agentId: AgentId, relativePath: string): string {
    const ws = this.getWorkspacePath(agentId);
    const filePath = path.join(ws, relativePath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found in bot workspace: ${relativePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  public writeFile(agentId: AgentId, relativePath: string, content: string): string {
    const ws = this.getWorkspacePath(agentId);
    const filePath = path.join(ws, relativePath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  public getWorkspaceInfo(agentId: AgentId): BotWorkspaceInfo {
    const ws = this.getWorkspacePath(agentId);
    const files = this.listFiles(agentId);
    return {
      agentId,
      directory: ws,
      activeProcesses: 0,
      openFiles: files.slice(0, 10),
    };
  }
}
