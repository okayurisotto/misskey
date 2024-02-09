import { Injectable } from '@nestjs/common';
import * as mfm from 'mfm-js';
import { MfmService } from '@/core/MfmService.js';
import { extractApHashtagObjects } from './models/tag.js';
import type { IObject } from './type.js';
import type { Note } from '@prisma/client';

@Injectable()
export class ApMfmService {
	constructor(private readonly mfmService: MfmService) {}

	public htmlToMfm(html: string, tag?: IObject | IObject[]): string {
		const hashtagNames = extractApHashtagObjects(tag).map((x) => x.name);
		return this.mfmService.fromHtml(html, hashtagNames);
	}

	public getNoteHtml(note: Note): string | null {
		if (!note.text) return '';
		return this.mfmService.toHtml(
			mfm.parse(note.text),
			JSON.parse(note.mentionedRemoteUsers),
		);
	}
}
