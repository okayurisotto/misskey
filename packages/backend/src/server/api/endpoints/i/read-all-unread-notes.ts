import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { NoteUnreadsRepository } from '@/models/index.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'write:account',
} as const;

export const paramDef = z.object({});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.noteUnreadsRepository)
		private noteUnreadsRepository: NoteUnreadsRepository,

		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Remove documents
			await this.noteUnreadsRepository.delete({
				userId: me.id,
			});

			// 全て既読になったイベントを発行
			this.globalEventService.publishMainStream(me.id, 'readAllUnreadMentions');
			this.globalEventService.publishMainStream(
				me.id,
				'readAllUnreadSpecifiedNotes',
			);
		});
	}
}
