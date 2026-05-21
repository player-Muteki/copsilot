import type { SessionUpdate, SessionConfigOption, ModeOption, AvailableCommand, ModelOption } from '../types';
import type { ChatState } from './chatState';
import type { ChatRenderer } from '../view/renderer';
import type { SyncEngine } from '../sync/engine';
import type { SyncContext } from '../sync/templates';
import type { SessionStore } from './session';
import { t } from '../i18n/index';

export interface StreamControllerDeps {
	state: ChatState;
	renderer: ChatRenderer;
	syncEngine: SyncEngine;
	sessionStore: SessionStore;
	getSessionId: () => string | null;
	onConfigUpdate?: (configOptions: SessionConfigOption[]) => void;
	onModeUpdate?: (currentModeId: string | null, availableModes: ModeOption[]) => void;
	onModelsUpdate?: (currentModelId: string | null, availableModels: ModelOption[]) => void;
	onCommandsUpdate?: (commands: AvailableCommand[]) => void;
	onSyncFailure?: (message: string) => void;
}

export class StreamController {
	private deps: StreamControllerDeps;
	private syncedToolCalls = new Set<string>();
	private pendingToolInputs = new Map<string, Record<string, unknown>>();
	private pendingToolKinds = new Map<string, string>();
	private assistantMessageIndex = new Map<string, number>();
	private assistantMessageBuffer = new Map<string, string>();
	private saveTimer: number | null = null;

	constructor(deps: StreamControllerDeps) {
		this.deps = deps;
	}

	handleChunk(ch: SessionUpdate): void {
		const { state, renderer } = this.deps;

		switch (ch.sessionUpdate) {
			case 'agent_message_chunk': {
				renderer.removeAssistantPlaceholder();
				const text = ch.content.text;
				renderer.appendText(text, ch.messageId);
				this.saveAssistantChunk(ch.messageId, text, 'text');
				break;
			}
			case 'agent_thought_chunk': {
				renderer.removeAssistantPlaceholder();
				const text = ch.content.text;
				renderer.appendThinking(text, ch.messageId);
				this.saveAssistantChunk(ch.messageId, text, 'thinking');
				break;
			}
			case 'tool_call': {
				renderer.addToolCall(ch.toolCallId, ch.title, ch.kind ?? 'other', ch.rawInput);
				if (ch.rawInput) this.pendingToolInputs.set(ch.toolCallId, ch.rawInput);
				if (ch.kind) this.pendingToolKinds.set(ch.toolCallId, ch.kind);
				break;
			}
			case 'tool_call_update': {
				const input = ch.rawInput ?? this.pendingToolInputs.get(ch.toolCallId);
				const kind = ch.kind ?? this.pendingToolKinds.get(ch.toolCallId);
				renderer.updateToolCall(ch.toolCallId, ch.status, ch.rawOutput, ch.content);

				if ((ch.status === 'completed' || ch.status === 'failed') && !this.syncedToolCalls.has(ch.toolCallId)) {
					this.syncedToolCalls.add(ch.toolCallId);
					const firstContent = ch.content?.[0];
					const contentText = firstContent?.type === 'content' && firstContent.content?.type === 'text' ? firstContent.content.text : '';
					const ctx: SyncContext = {
						toolCallId: ch.toolCallId,
						toolName: kind ?? 'unknown',
						toolStatus: ch.status,
						rawInput: input,
						rawOutput: ch.rawOutput,
						content: contentText,
					};
					this.deps.syncEngine.process(ctx).then((failures) => {
						for (const failure of failures) {
							this.deps.onSyncFailure?.(t().sync.ruleFailed
								.replace('{rule}', failure.rule.toolName)
								.replace('{error}', failure.error.message));
						}
					}).catch(e => {
						console.error('[copsidian] sync failed:', e);
						this.deps.onSyncFailure?.(e instanceof Error ? e.message : String(e));
					});
				}
				break;
			}
			case 'plan': {
				renderer.setPlanEntries(ch.entries);
				break;
			}
			case 'config_option_update': {
				state.configOptions = ch.configOptions;
				this.deps.onConfigUpdate?.(ch.configOptions);
				break;
			}
			case 'available_commands_update': {
				state.availableCommands = ch.availableCommands;
				this.deps.onCommandsUpdate?.(ch.availableCommands);
				break;
			}
			case 'usage_update': {
				state.usage = {
					totalTokens: ch.totalTokens ?? ch.used ?? 0,
					inputTokens: ch.inputTokens ?? 0,
					outputTokens: ch.outputTokens ?? 0,
					thoughtTokens: ch.thoughtTokens,
					cost: ch.cost,
				};
				break;
			}
			case 'current_mode_update': {
				if (ch.currentModeId !== undefined) state.currentModeId = ch.currentModeId;
				if (ch.availableModes) state.availableModes = ch.availableModes;
				this.deps.onModeUpdate?.(state.currentModeId, state.availableModes);
				break;
			}
			case 'current_model_update': {
				if (ch.currentModelId !== undefined) state.currentModelId = ch.currentModelId;
				if (ch.availableModels) state.availableModels = ch.availableModels;
				this.deps.onModelsUpdate?.(state.currentModelId, state.availableModels);
				break;
			}
			case 'session_info_update': {
				const sid = ch.sessionId ?? this.deps.getSessionId();
				if (sid && ch.title) {
					const session = this.deps.sessionStore.get(sid);
					if (session) {
						session.title = ch.title;
						this.scheduleSave();
					}
				}
				break;
			}
			case 'user_message_chunk': {
				break;
			}
		}
	}

	reset(): void {
		this.syncedToolCalls.clear();
		this.pendingToolInputs.clear();
		this.pendingToolKinds.clear();
		this.assistantMessageIndex.clear();
		this.assistantMessageBuffer.clear();
		this.deps.state.resetStreamingState();
		if (this.saveTimer !== null) {
			clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
	}

	private saveAssistantChunk(messageId: string, chunk: string, type: 'text' | 'thinking'): void {
		const sessionId = this.deps.getSessionId();
		if (!sessionId) return;

		const key = `${sessionId}:${messageId}:${type}`;
		const index = this.assistantMessageIndex.get(key);
		const buffer = (this.assistantMessageBuffer.get(key) ?? '') + chunk;
		this.assistantMessageBuffer.set(key, buffer);

		if (index === undefined) {
			this.deps.sessionStore.getOrCreate(sessionId);
			const session = this.deps.sessionStore.get(sessionId);
			if (!session) return;
			session.messages.push({
				role: 'assistant',
				content: buffer,
				type,
				timestamp: Date.now(),
			});
			this.assistantMessageIndex.set(key, session.messages.length - 1);
			session.updatedAt = Date.now();
		} else {
			const session = this.deps.sessionStore.get(sessionId);
			if (!session) return;
			const msg = session.messages[index];
			if (msg) msg.content = buffer;
			session.updatedAt = Date.now();
		}
		this.deps.sessionStore.setActive(sessionId);
		this.scheduleSave();
	}

	saveMessage(role: 'user' | 'assistant', content: string, type: string): void {
		const sessionId = this.deps.getSessionId();
		if (!sessionId) return;
		this.deps.sessionStore.getOrCreate(sessionId);
		this.deps.sessionStore.append(sessionId, {
			role,
			content,
			type: type as 'text' | 'tool-call' | 'tool-result' | 'thinking',
			timestamp: Date.now(),
		});
		this.deps.sessionStore.setActive(sessionId);
		this.scheduleSave();
	}

	private scheduleSave(): void {
		if (this.saveTimer !== null) clearTimeout(this.saveTimer);
		this.saveTimer = window.setTimeout(() => this.deps.sessionStore.save(), 500);
	}
}
