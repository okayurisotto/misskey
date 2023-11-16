import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { noSuchNote_____________, notReacted } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { ReactionService } from '@/core/ReactionService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['reactions', 'notes'],
	requireCredential: true,
	kind: 'write:reactions',
	limit: {
		duration: ms('1hour'),
		max: 60,
		minInterval: ms('3sec'),
	},
	errors: { noSuchNote: noSuchNote_____________, notReacted: notReacted },
} as const;

export const paramDef = z.object({
	noteId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private getterService: GetterService,
		private reactionService: ReactionService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});
			await this.reactionService.delete(me, note).catch((err) => {
				if (err.id === '60527ec9-b4cb-4a88-a6bd-32d3ad26817d') {
					throw new ApiError(meta.errors.notReacted);
				}
				throw err;
			});
		});
	}
}
