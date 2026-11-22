import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Terminal, 
  ShieldCheck, 
  FolderGit2, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Cpu, 
  ChevronRight, 
  Layers, 
  Activity, 
  Zap, 
  Globe, 
  CornerDownLeft,
  Code2,
  Lock
} from 'lucide-react';
import { AgentDefinition, ChatMessage } from '../core/types/agent.ts';
import { ApprovalRequest } from '../core/types/approval.ts';

export default function App() {
  const [bots, setBots] = useState<AgentDefinition[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedBot, setSelectedBot] = useState<string>('all');
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [activeInspectorTab, setActiveInspectorTab] = useState<'workspace' | 'terminal' | 'byos'>('workspace');
  const [botWorkspaceInfo, setBotWorkspaceInfo] = useState<any>(null);
  const [isSwarmThinking, setIsSwarmThinking] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Fetch initial bots and messages
  useEffect(() => {
    fetch('http://localhost:3001/api/bots')
      .then(res => res.json())
      .then(data => {
        if (data.bots) setBots(data.bots);
      })
      .catch(() => {
        // Fallback demo bots if server is starting
        setBots([
          { id: 'chief', name: 'Chief of Staff', role: 'Chief of Staff', avatar: '👑', color: '#0EA5E9', description: 'Swarm coordinator and planner', systemPrompt: '', workspacePath: 'chief', toolsAllowed: [], preferredModel: 'claude_cli' },
          { id: 'dev', name: 'DevBot', role: 'Full-Stack Engineer', avatar: '⚡', color: '#10B981', description: 'Full-stack builder and coder', systemPrompt: '', workspacePath: 'dev', toolsAllowed: [], preferredModel: 'codex_cli' },
          { id: 'research', name: 'ResearchBot', role: 'Deep Researcher', avatar: '🔍', color: '#8B5CF6', description: 'Web scraper and technical investigator', systemPrompt: '', workspacePath: 'research', toolsAllowed: [], preferredModel: 'gemini_api' },
          { id: 'design', name: 'DesignBot', role: 'UI/UX Designer', avatar: '🎨', color: '#F43F5E', description: 'Curved minimalist UI architect', systemPrompt: '', workspacePath: 'design', toolsAllowed: [], preferredModel: 'gemini_api' },
          { id: 'review', name: 'ReviewBot', role: 'QA & Code Reviewer', avatar: '🛡️', color: '#F59E0B', description: 'Security and quality auditor', systemPrompt: '', workspacePath: 'review', toolsAllowed: [], preferredModel: 'ollama' },
        ]);
      });

    fetch('http://localhost:3001/api/messages')
      .then(res => res.json())
      .then(data => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          // Default initial greeting
          setMessages([
            {
              id: 'init_1',
              senderId: 'chief',
              senderName: 'Chief of Staff',
              senderRole: 'Chief of Staff',
              content: '👋 Welcome to **GrabBots**! I am your Chief of Staff. I coordinate your private team of autonomous bots—each with its own isolated virtual computer workspace and memory.\n\nYou can talk to the whole swarm or @mention specific specialists like `@DevBot`, `@ResearchBot`, `@DesignBot`, or `@ReviewBot`. What shall we build today?',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          ]);
        }
      })
      .catch(() => {});

    fetch('http://localhost:3001/api/approvals')
      .then(res => res.json())
      .then(data => {
        if (data.pending) setPendingApprovals(data.pending);
      })
      .catch(() => {});
  }, []);

  // Connect WebSocket stream
  useEffect(() => {
    let ws: WebSocket;
    try {
      ws = new WebSocket('ws://localhost:3001');
      ws.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);
          if (type === 'new_message') {
            setMessages(prev => [...prev, payload]);
            setIsSwarmThinking(false);
          } else if (type === 'approval_required') {
            setPendingApprovals(prev => [...prev, payload]);
          } else if (type === 'bot_status') {
            if (payload.status === 'thinking' || payload.status === 'executing_tool') {
              setIsSwarmThinking(true);
            } else {
              setIsSwarmThinking(false);
            }
          }
        } catch (e) {
          console.error(e);
        }
      };
    } catch (e) {}

    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Scroll to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingApprovals]);

  // Fetch workspace details on bot select
  useEffect(() => {
    if (selectedBot !== 'all') {
      fetch(`http://localhost:3001/api/workspaces/${selectedBot}`)
        .then(res => res.json())
        .then(data => {
          if (data.workspace) setBotWorkspaceInfo(data.workspace);
        })
        .catch(() => {});
    }
  }, [selectedBot]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const content = input.trim();
    setInput('');
    setIsSwarmThinking(true);

    // Optimistically show user message
    const tempUserMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      senderId: 'user',
      senderName: 'You',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      await fetch('http://localhost:3001/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
    } catch (err) {
      console.error(err);
      setIsSwarmThinking(false);
    }
  };

  const handleResolveApproval = async (requestId: string, decision: 'approve' | 'reject') => {
    try {
      await fetch(`http://localhost:3001/api/approvals/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      setPendingApprovals(prev => prev.filter(req => req.id !== requestId));
    } catch (err) {
      console.error(err);
    }
  };

  const appendMention = (mentionTag: string) => {
    setInput(prev => `${prev} ${mentionTag} `.trimStart());
  };

  return (
    <div className="flex h-screen w-screen bg-[#0B0D11] text-gray-200 overflow-hidden font-sans">
      {/* LEFT SIDEBAR: Bot Swarm Roster */}
      <aside className="w-80 border-r border-[#1E2536] bg-[#0E1118]/80 backdrop-blur-md flex flex-col justify-between p-4 shrink-0">
        <div className="space-y-4">
          {/* Logo & Brand Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2536]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-glow-cyan">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-base tracking-tight text-white flex items-center gap-1.5">
                  GrabBots
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">v0.1</span>
                </h1>
                <p className="text-xs text-gray-400 font-light">Grok Bot Alternative</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live
            </div>
          </div>

          {/* Swarm Roster */}
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">Agent Team</span>
              <span className="text-[11px] font-mono text-gray-500">{bots.length} active</span>
            </div>

            <div className="space-y-1.5">
              <button
                onClick={() => setSelectedBot('all')}
                className={`w-full text-left p-2.5 rounded-2xl transition-all flex items-center justify-between ${
                  selectedBot === 'all' 
                    ? 'bg-cyan-500/10 border border-cyan-500/30 text-white' 
                    : 'hover:bg-white/5 text-gray-300 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">🌐</span>
                  <div>
                    <div className="text-sm font-medium">All Bots (Group Chat)</div>
                    <div className="text-xs text-gray-400 font-light">Shared Swarm Feed</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>

              {bots.map(bot => (
                <button
                  key={bot.id}
                  onClick={() => setSelectedBot(bot.id)}
                  className={`w-full text-left p-2.5 rounded-2xl transition-all flex items-center justify-between group ${
                    selectedBot === bot.id 
                      ? 'bg-white/10 border border-white/20 text-white' 
                      : 'hover:bg-white/5 text-gray-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#1A202C] flex items-center justify-center text-base border border-white/10">
                      {bot.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        {bot.name}
                        {bot.id === 'chief' && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">Lead</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 font-light truncate max-w-[150px]">{bot.role}</div>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-400/80"></div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom BYOS Status Card */}
        <div className="p-3 rounded-2xl bg-[#121622] border border-[#1E2536] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-gray-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              BYOS Bridge
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Ready
            </span>
          </div>
          <p className="text-[11px] text-gray-400 font-light leading-relaxed">
            Running on your existing Claude Pro & ChatGPT Plus subscriptions. $0 per-token billing.
          </p>
        </div>
      </aside>

      {/* CENTER: Multi-Agent Group Chat */}
      <main className="flex-1 flex flex-col h-full bg-[#0B0D11] relative">
        {/* Top Header Pill Bar */}
        <header className="h-16 border-b border-[#1E2536] px-6 flex items-center justify-between bg-[#0B0D11]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              {selectedBot === 'all' ? 'Team Channel #general' : `@${bots.find(b => b.id === selectedBot)?.name}`}
            </div>
            <span className="text-xs text-gray-500">•</span>
            <div className="text-xs text-gray-400 flex items-center gap-2 font-light">
              <span>Isolated Workspaces: <code className="font-mono text-cyan-300">~/.grabbots/workspaces/</code></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pendingApprovals.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                {pendingApprovals.length} Approval Pending
              </div>
            )}
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#141824] border border-[#1E2536] text-xs font-mono text-gray-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              HITL Policy Active
            </div>
          </div>
        </header>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.map((msg) => {
            const isUser = msg.senderId === 'user';
            const botMeta = bots.find(b => b.id === msg.senderId);

            return (
              <div 
                key={msg.id} 
                className={`flex gap-3.5 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {!isUser ? (
                  <div className="w-9 h-9 rounded-2xl bg-[#141824] border border-[#242D40] flex items-center justify-center text-lg shrink-0 shadow-sm">
                    {botMeta?.avatar || '🤖'}
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-700 flex items-center justify-center text-sm font-medium text-white shrink-0 shadow-sm">
                    U
                  </div>
                )}

                <div className={`space-y-1.5 max-w-[85%] ${isUser ? 'items-end' : ''}`}>
                  <div className={`flex items-center gap-2 text-xs ${isUser ? 'justify-end' : ''}`}>
                    <span className="font-medium text-gray-300">{msg.senderName}</span>
                    {msg.senderRole && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white/5 text-gray-400 border border-white/10">
                        {msg.senderRole}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-500 font-mono">{msg.timestamp}</span>
                  </div>

                  <div 
                    className={`p-4 rounded-3xl text-sm leading-relaxed ${
                      isUser 
                        ? 'bg-cyan-600 text-white rounded-tr-sm shadow-glow-cyan' 
                        : 'bg-[#121622] border border-[#1E2536] text-gray-200 rounded-tl-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-normal">
                      {msg.content}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pending HITL Approvals Cards */}
          {pendingApprovals.map(req => (
            <div key={req.id} className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 max-w-2xl mx-auto space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-semibold text-amber-200">Human-in-the-Loop Approval Required</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {req.riskLevel} Risk
                </span>
              </div>

              <div className="text-xs text-gray-300">
                <span className="font-medium text-white">{req.agentName}</span> is requesting to execute:
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/10 font-mono text-xs text-amber-300 overflow-x-auto">
                <code>{req.commandOrAction}</code>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => handleResolveApproval(req.id, 'reject')}
                  className="px-3.5 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium transition-all flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </button>
                <button
                  onClick={() => handleResolveApproval(req.id, 'approve')}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-all shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve & Execute
                </button>
              </div>
            </div>
          ))}

          {/* Thinking Indicator */}
          {isSwarmThinking && (
            <div className="flex items-center gap-2.5 text-xs text-cyan-400 font-mono animate-pulse">
              <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
              <span>Swarm coordinating turns & running tool pipeline...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Input Bar & Mentions Bar */}
        <div className="p-4 border-t border-[#1E2536] bg-[#0B0D11] space-y-2.5">
          {/* Quick Mention Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-mono text-gray-500 mr-1">Tag Specialist:</span>
            {bots.map(bot => (
              <button
                key={bot.id}
                onClick={() => appendMention(`@${bot.name.replace(/\s+/g, '')}`)}
                className="px-2.5 py-1 rounded-full bg-[#141824] hover:bg-[#1E2536] border border-[#242D40] text-gray-300 hover:text-white transition-all flex items-center gap-1 shrink-0 font-mono text-[11px]"
              >
                <span>{bot.avatar}</span>
                <span>@{bot.name}</span>
              </button>
            ))}
          </div>

          {/* Main Input Form */}
          <form onSubmit={handleSendMessage} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Chief of Staff or tag @DevBot, @ResearchBot, @DesignBot..."
              className="w-full bg-[#121622] border border-[#1E2536] focus:border-cyan-500/50 rounded-3xl py-3.5 pl-5 pr-14 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all font-light"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="absolute right-2.5 w-9 h-9 rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:hover:bg-cyan-600 text-white flex items-center justify-center transition-all shadow-glow-cyan"
            >
              <CornerDownLeft className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      {/* RIGHT PANEL: Bot Computer Inspector */}
      <aside className="w-80 border-l border-[#1E2536] bg-[#0E1118]/80 backdrop-blur-md flex flex-col p-4 shrink-0 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1E2536]">
          <span className="text-sm font-medium text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            Bot Computer
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
            Sandbox
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-2xl bg-[#121622] p-1 border border-[#1E2536] text-xs font-medium">
          <button
            onClick={() => setActiveInspectorTab('workspace')}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              activeInspectorTab === 'workspace' ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            Workspace
          </button>
          <button
            onClick={() => setActiveInspectorTab('terminal')}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              activeInspectorTab === 'terminal' ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            Terminal
          </button>
          <button
            onClick={() => setActiveInspectorTab('byos')}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              activeInspectorTab === 'byos' ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            BYOS Models
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {activeInspectorTab === 'workspace' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-[#121622] border border-[#1E2536] space-y-1.5">
                <div className="text-[11px] font-mono text-gray-400 uppercase">Dedicated Directory</div>
                <div className="text-xs font-mono text-cyan-300 break-all bg-black/30 p-2 rounded-xl">
                  {botWorkspaceInfo?.directory || `~/.grabbots/workspaces/${selectedBot === 'all' ? 'chief' : selectedBot}`}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#121622] border border-[#1E2536] space-y-2">
                <div className="text-[11px] font-mono text-gray-400 uppercase">Isolated Files</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-gray-300 p-1.5 rounded-lg hover:bg-white/5">
                    <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>WORKSPACE.md</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-300 p-1.5 rounded-lg hover:bg-white/5">
                    <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>scratch/</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-300 p-1.5 rounded-lg hover:bg-white/5">
                    <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>output/</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeInspectorTab === 'terminal' && (
            <div className="p-3 rounded-2xl bg-black border border-[#1E2536] font-mono text-xs text-emerald-400 space-y-2 h-64 overflow-y-auto">
              <div className="text-gray-500 text-[10px]">[GrabBots PTY Kernel Ready]</div>
              <div>$ pnpm dev:all</div>
              <div className="text-gray-400">[Express] Port 3001 online</div>
              <div className="text-gray-400">[WebSocket] ws://localhost:3001 attached</div>
              <div className="text-cyan-400">[Swarm] 5 isolated bot computers online</div>
              <div className="text-gray-500 animate-pulse">_</div>
            </div>
          )}

          {activeInspectorTab === 'byos' && (
            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl bg-[#121622] border border-[#1E2536] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">Claude Code CLI</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Connected</span>
                </div>
                <p className="text-[11px] text-gray-400 font-light">Claude 3.7 Sonnet (Claude Pro Subscription)</p>
              </div>

              <div className="p-3 rounded-2xl bg-[#121622] border border-[#1E2536] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">Codex CLI</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Connected</span>
                </div>
                <p className="text-[11px] text-gray-400 font-light">GPT-4o (ChatGPT Plus Subscription)</p>
              </div>

              <div className="p-3 rounded-2xl bg-[#121622] border border-[#1E2536] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">Ollama Local</span>
                  <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">Local Standby</span>
                </div>
                <p className="text-[11px] text-gray-400 font-light">qwen2.5-coder:14b / llama3.3:70b</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-[#1E2536] text-[10px] text-gray-500 text-center font-mono">
          Local-first • Private • Isolated Workspaces
        </div>
      </aside>
    </div>
  );
}
