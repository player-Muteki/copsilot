import type {
  SessionUpdate,
  PromptPart,
  SessionConfigOption,
  PermissionRequest,
  AvailableCommand,
  ModelOption,
  ModeOption,
  AcpResponse,
  SessionSnapshot,
  McpServerConfig,
} from '../types';
import type { OpencodeClient, ClientHandlers } from './index';
import type { SessionMeta } from '../types';
import { AcpClient } from './acp';

export class AgentRuntime implements OpencodeClient {
  permissionMode = 'yolo';

  constructor(private acp: AcpClient) {}

  isConnected(): boolean { return this.acp.isConnected(); }
  connect(): Promise<void> { return this.acp.connect(); }
  disconnect(): Promise<void> { return this.acp.disconnect(); }
  createSession(cwd?: string, mcpServers?: McpServerConfig[]): Promise<string> { return this.acp.createSession(cwd, mcpServers); }
  loadSession(id: string, cwd?: string): Promise<void> { return this.acp.loadSession(id, cwd); }
  listSessions(cwd?: string): Promise<SessionMeta[]> { return this.acp.listSessions(cwd); }
  closeSession(id: string): Promise<void> { return this.acp.closeSession(id); }
  forkSession(id: string, cwd?: string): Promise<string> { return this.acp.forkSession(id, cwd); }
  resumeSession(id: string, cwd?: string): Promise<void> { return this.acp.resumeSession(id, cwd); }
  setMode(id: string, mode: string): Promise<void> { return this.acp.setMode(id, mode); }
  setModel(id: string, model: string): Promise<void> { return this.acp.setModel(id, model); }

  async setConfigOption(id: string, cid: string, val: string): Promise<SessionConfigOption[]> {
    return this.acp.setConfigOption(id, cid, val);
  }

  async sendMessage(id: string, parts: PromptPart[], handler: (u: SessionUpdate) => void): Promise<AcpResponse> {
    const timeoutMs = 5 * 60 * 1000; // 5 minutes
    return new Promise<AcpResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.acp.cancel(id).catch(() => {});
        reject(new Error('Request timeout (5 minutes)'));
      }, timeoutMs);

      this.acp.sendMessage(id, parts, handler)
        .then((res) => {
          clearTimeout(timeout);
          resolve(res as AcpResponse);
        })
        .catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
    });
  }

  setClientHandlers(handlers: ClientHandlers): void {
    this.acp.onClose = handlers.onClose ?? undefined;
    this.acp.onReconnect = handlers.onReconnect ?? undefined;
    this.acp.onPermissionRequest = handlers.onPermissionRequest ?? undefined;
  }

  cancel(id: string): Promise<void> { return this.acp.cancel(id); }
  compact(id: string): Promise<void> { return this.acp.compact(id); }

  async requestPermission(req: PermissionRequest): Promise<string> {
    if (this.permissionMode === 'yolo') {
      const allow = req.options.find((o) => o.kind === 'allow_always');
      if (allow) return allow.optionId;
      return req.options[0]?.optionId ?? 'allow_once';
    }
    if (this.permissionMode === 'plan') {
      if (['read', 'search'].includes(req.toolCall.kind)) {
        const allow = req.options.find((o) => o.kind === 'allow_always' || o.kind === 'allow_once');
        if (allow) return allow.optionId;
      }
      const reject = req.options.find((o) => o.kind === 'reject_once');
      if (reject) return reject.optionId;
    }
    return this.acp.requestPermission(req);
  }

  getAvailableAgents(): Promise<ModeOption[]> { return this.acp.getAvailableAgents(); }
  getAvailableModels(): Promise<ModelOption[]> { return this.acp.getAvailableModels(); }
  getAvailableCommands(): Promise<AvailableCommand[]> { return this.acp.getAvailableCommands(); }
  getSessionSnapshot(): SessionSnapshot { return this.acp.getSessionSnapshot(); }
  getCurrentSessionId(): string | undefined { return this.acp.getCurrentSessionId(); }
}
