import { spawn, type ChildProcess } from 'child_process';
const SIGKILL_TIMEOUT_MS = 3_000;
const STDERR_BUFFER_LIMIT = 8_000;
export interface AcpSubprocessLaunchSpec {
  args: string[];
  command: string;
  cwd: string;
}
type CloseListener = (error?: Error) => void;
export class AcpSubprocess {
  private proc: ChildProcess | null = null;
  private stderrBuffer = '';
  private readonly closeListeners = new Set<CloseListener>();
  constructor(private readonly launchSpec: AcpSubprocessLaunchSpec) {}
  get stdin(): NodeJS.WritableStream | null {
    return this.proc?.stdin ?? null;
  }
  get stdout(): NodeJS.ReadableStream | null {
    return this.proc?.stdout ?? null;
  }
  start(): void {
    if (this.proc) return;
    const proc = spawn(this.launchSpec.command, this.launchSpec.args, {
      cwd: this.launchSpec.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
    });
    proc.stdin?.on('error', (e: unknown) => console.error('[copsidian] stdin:', e));
    proc.stderr?.on('data', (chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      this.stderrBuffer = `${this.stderrBuffer}${text}`.slice(-STDERR_BUFFER_LIMIT);
    });
    proc.on('error', (error) => this.notifyClose(error));
    proc.on('exit', (code, signal) => {
      const exitError = code === 0 && signal === null
        ? undefined
        : new Error(`ACP process exited (code=${code}, signal=${signal})`);
      this.notifyClose(exitError);
    });
    this.proc = proc;
  }
  isAlive(): boolean {
    return this.proc !== null && this.proc.exitCode === null && !this.proc.killed;
  }
  getStderrSnapshot(): string {
    return this.stderrBuffer.trim();
  }
  onClose(listener: CloseListener): () => void {
    this.closeListeners.add(listener);
    return () => { this.closeListeners.delete(listener); };
  }
  async shutdown(): Promise<void> {
    if (!this.proc || this.proc.exitCode !== null) return;
    await new Promise<void>((resolve) => {
      const proc = this.proc!;
      const onDone = () => { proc.removeAllListeners(); resolve(); };
      proc.once('close', onDone);
      try { proc.kill(); } catch { onDone(); }
      setTimeout(onDone, SIGKILL_TIMEOUT_MS);
    });
    this.proc = null;
  }
  private notifyClose(error?: Error): void {
    for (const listener of this.closeListeners) {
      try { listener(error); } catch { /* ignore */ }
    }
  }
}
