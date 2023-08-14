import { Inject, Injectable } from '@nestjs/common';
import * as mfm from 'mfm-js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { MfmService } from '@/core/MfmService.js';
import { bindThis } from '@/decorators.js';
import { extractApHashtagObjects } from './models/tag.js';
import type { IObject } from './type.js';
import type { note } from '@prisma/client';

@Injectable()
export class ApMfmService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		private mfmService: MfmService,
	) {
	}

	@bindThis
	public htmlToMfm(html: string, tag?: IObject | IObject[]): string {
		const hashtagNames = extractApHashtagObjects(tag).map(x => x.name);
		return this.mfmService.fromHtml(html, hashtagNames);
	}

	@bindThis
	public getNoteHtml(note: note): string | null {
		if (!note.text) return '';
		return this.mfmService.toHtml(mfm.parse(note.text), JSON.parse(note.mentionedRemoteUsers));
	}
}
