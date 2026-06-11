import { spawn, type ChildProcess } from 'child_process';
import type { TerminalInstance, TerminalCreateParams, TerminalOutputResult } from '../types';

export interface TerminalManagerOptions {
	timeoutMs: number;
	maxOutputBytes: number;
}

const ALLOWED_COMMANDS = new Set([
	'sh', 'bash', 'zsh', 'dash', 'ksh',
	'cmd', 'powershell', 'pwsh',
	'node', 'python', 'python3', 'pip', 'pip3',
	'git', 'npm', 'npx', 'yarn', 'pnpm', 'bun', 'deno',
	'cat', 'grep', 'find', 'ls', 'echo', 'head', 'tail', 'wc', 'sort', 'uniq', 'cut', 'tee',
	'which', 'where', 'type', 'date', 'sleep', 'env', 'printenv', 'pwd',
	'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'chmod', 'chown',
	'curl', 'wget', 'http',
	'opencode',
]);

export class TerminalError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TerminalError';
	}
}

function getBaseCommand(command: string): string {
	return command.trim().split(/[\\/]/).pop()?.split(/\s+/)[0]?.toLowerCase() ?? '';
}

function isAllowedCommand(command: string): boolean {
	const base = getBaseCommand(command);
	if (!base) return false;
	const withoutExt = base.replace(/\.(exe|cmd|bat|ps1|sh)$/i, '');
	return ALLOWED_COMMANDS.has(withoutExt);
}

interface ExitWaiter {
	resolve: (value: { exitCode: number | null; signal: string | null } | null) => void;
	timeout: number;
}

export class TerminalManager {
	private terminals = new Map<string, TerminalInstance>();
	private processes = new Map<string, ChildProcess>();
	private exitWaiters = new Map<string, ExitWaiter>();
	private nextId = 1;
	private timeoutMs: number;
	private maxOutputBytes: number;

	constructor(options: TerminalManagerOptions) {
		this.timeoutMs = options.timeoutMs;
		this.maxOutputBytes = options.maxOutputBytes;
	}

	create(params: TerminalCreateParams, vaultPath: string): TerminalInstance {
		const terminalId = `term-${this.nextId++}`;
		const cwd = params.cwd || vaultPath;
		const args = params.args || [];

		if (!params.command || !params.command.trim()) {
			throw new TerminalError('Command is empty');
		}

		if (!isAllowedCommand(params.command)) {
			throw new TerminalError(`Command not allowed: ${getBaseCommand(params.command)}`);
		}

		const instance: TerminalInstance = {
			terminalId,
			command: params.command,
			args,
			cwd,
			pid: null,
			status: 'running',
			output: '',
			exitCode: null,
			signal: null,
			createdAt: Date.now(),
		};

		this.terminals.set(terminalId, instance);
		this.spawnProcess(terminalId, params.command, args, cwd, params.env);

		return instance;
	}

	/**
	 * Get terminal output and status.
	 */
	output(terminalId: string): TerminalOutputResult {
		const instance = this.terminals.get(terminalId);
		if (!instance) {
			return { output: '', error: `Terminal not found: ${terminalId}` };
		}

		return {
			output: instance.output,
			exitStatus: instance.status !== 'running'
				? { exitCode: instance.exitCode, signal: instance.signal }
				: undefined,
		};
	}

	/**
	 * Kill a running terminal process.
	 */
	kill(terminalId: string): boolean {
		const proc = this.processes.get(terminalId);
		const instance = this.terminals.get(terminalId);

		if (!proc || !instance) {
			return false;
		}

		if (instance.status !== 'running') {
			return false;
		}

		try {
			proc.kill('SIGTERM');
			instance.status = 'killed';
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Release a terminal and clean up resources.
	 */
	release(terminalId: string): boolean {
		const instance = this.terminals.get(terminalId);
		if (!instance) {
			return false;
		}

		if (instance.status === 'running') {
			this.kill(terminalId);
		}

		this.terminals.delete(terminalId);
		this.processes.delete(terminalId);
		return true;
	}

	async waitForExit(terminalId: string): Promise<{ exitCode: number | null; signal: string | null } | null> {
		const instance = this.terminals.get(terminalId);
		if (!instance) {
			return null;
		}

		if (instance.status !== 'running') {
			return { exitCode: instance.exitCode, signal: instance.signal };
		}

		return new Promise((resolve) => {
			const timeout = window.setTimeout(() => {
				this.exitWaiters.delete(terminalId);
				this.kill(terminalId);
				resolve({ exitCode: null, signal: 'SIGTERM' });
			}, this.timeoutMs);

			this.exitWaiters.set(terminalId, { resolve, timeout });
		});
	}

	/**
	 * Get all terminal instances.
	 */
	getAll(): TerminalInstance[] {
		return [...this.terminals.values()];
	}

	/**
	 * Get a specific terminal instance.
	 */
	get(terminalId: string): TerminalInstance | undefined {
		return this.terminals.get(terminalId);
	}

	/**
	 * Clean up all terminals.
	 */
	dispose(): void {
		for (const [, waiter] of this.exitWaiters) {
			window.clearTimeout(waiter.timeout);
		}
		this.exitWaiters.clear();

		for (const [terminalId] of this.terminals) {
			this.kill(terminalId);
		}
		this.terminals.clear();
		this.processes.clear();
	}

	private spawnProcess(
		terminalId: string,
		command: string,
		args: string[],
		cwd: string,
		env?: Record<string, string>,
	): void {
		const instance = this.terminals.get(terminalId);
		if (!instance) return;

		try {
			const useShell = /\.(cmd|bat)$/i.test(command);
			const proc = spawn(command, args, {
				cwd,
				stdio: ['pipe', 'pipe', 'pipe'],
				windowsHide: true,
				shell: useShell,
				env: env ? { ...process.env, ...env } : undefined,
			});

			instance.pid = proc.pid ?? null;
			this.processes.set(terminalId, proc);

			// Collect stdout
			proc.stdout?.on('data', (chunk: Buffer | string) => {
				const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
				instance.output = (instance.output + text).slice(-this.maxOutputBytes);
			});

			// Collect stderr
			proc.stderr?.on('data', (chunk: Buffer | string) => {
				const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
				instance.output = (instance.output + text).slice(-this.maxOutputBytes);
			});

			proc.on('exit', (code, signal) => {
				instance.status = 'exited';
				instance.exitCode = code;
				instance.signal = signal;
				this.processes.delete(terminalId);

				const waiter = this.exitWaiters.get(terminalId);
				if (waiter) {
					window.clearTimeout(waiter.timeout);
					this.exitWaiters.delete(terminalId);
					waiter.resolve({ exitCode: code, signal });
				}
			});

			// Handle process error
			proc.on('error', (err) => {
				instance.status = 'exited';
				instance.output += `\nError: ${err.message}`;
				instance.exitCode = 1;
				this.processes.delete(terminalId);

				const waiter = this.exitWaiters.get(terminalId);
				if (waiter) {
					window.clearTimeout(waiter.timeout);
					this.exitWaiters.delete(terminalId);
					waiter.resolve({ exitCode: 1, signal: null });
				}
			});

			// Set timeout
			window.setTimeout(() => {
				if (instance.status === 'running') {
					this.kill(terminalId);
					instance.output += '\n[Process timed out]';
				}
			}, this.timeoutMs);

		} catch (err) {
			instance.status = 'exited';
			instance.exitCode = 1;
			instance.output = `Failed to spawn process: ${err instanceof Error ? err.message : String(err)}`;
		}
	}
}
