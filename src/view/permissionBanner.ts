import type { PermissionRequest } from '../types';
import { t } from '../i18n/index';

export class PermissionBanner {
	private el: HTMLDivElement | null = null;

	constructor(private containerEl: HTMLElement) {}

	show(req: PermissionRequest): Promise<string> {
		return new Promise((resolve) => {
			this.dismiss();
			const banner = this.containerEl.createDiv({ cls: 'copsidian-permission-banner' });
			this.el = banner;

			const title = req.toolCall.title || req.toolCall.kind;
			banner.createDiv({ cls: 'perm-title', text: t().permission.title.replace('{title}', title) });

			if (req.toolCall.locations?.length) {
				banner.createDiv({ cls: 'perm-path', text: req.toolCall.locations[0].path });
			}

			const actions = banner.createDiv({ cls: 'perm-actions' });
			for (const opt of req.options) {
				const btn = actions.createEl('button', {
					text: opt.name,
					cls: `perm-btn perm-${opt.kind}`,
				});
				btn.onclick = () => {
					this.dismiss();
					resolve(opt.optionId);
				};
			}

			this.containerEl.scrollTop = this.containerEl.scrollHeight;
		});
	}

	dismiss(): void {
		if (this.el) {
			this.el.remove();
			this.el = null;
		}
	}
}
