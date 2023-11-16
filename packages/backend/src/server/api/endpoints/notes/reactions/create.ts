import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import {
	noSuchNote____________,
	alreadyReacted,
	youHaveBeenBlocked__,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GetterService } from '@/server/api/GetterService.js';
import { ReactionService } from '@/core/ReactionService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['reactions', 'notes'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:reactions',
	errors: {
		noSuchNote: noSuchNote____________,
		alreadyReacted: alreadyReacted,
		youHaveBeenBlocked: youHaveBeenBlocked__,
	},
} as const;

export const paramDef = z.object({
	noteId: MisskeyIdSchema,
	reaction: z.string(),
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
			await this.reactionService.create(me, note, ps.reaction).catch((err) => {
				if (err.id === '51c42bb4-931a-456b-bff7-e5a8a70dd298') {
					throw new ApiError(meta.errors.alreadyReacted);
				}
				if (err.id === 'e70412a4-7197-4726-8e74-f3e0deb92aa7') {
					throw new ApiError(meta.errors.youHaveBeenBlocked);
				}
				throw err;
			});
			return;
		});
	}
}
