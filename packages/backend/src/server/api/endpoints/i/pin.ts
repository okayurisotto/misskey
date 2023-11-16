import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import {
	noSuchNote___,
	pinLimitExceeded,
	alreadyPinned,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { NotePiningService } from '@/core/NotePiningService.js';
import { MeDetailedSchema } from '@/models/zod/MeDetailedSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = MeDetailedSchema;
export const meta = {
	tags: ['account', 'notes'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	errors: {
		noSuchNote: noSuchNote___,
		pinLimitExceeded: pinLimitExceeded,
		alreadyPinned: alreadyPinned,
	},
	res,
} as const;

export const paramDef = z.object({
	noteId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly notePiningService: NotePiningService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.notePiningService.addPinned(me, ps.noteId).catch((err) => {
				if (err.id === '70c4e51f-5bea-449c-a030-53bee3cce202') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				if (err.id === '15a018eb-58e5-4da1-93be-330fcc5e4e1a') {
					throw new ApiError(meta.errors.pinLimitExceeded);
				}
				if (err.id === '23f0cf4e-59a3-4276-a91d-61a5891c1514') {
					throw new ApiError(meta.errors.alreadyPinned);
				}
				throw err;
			});

			return await this.userEntityService.packDetailedMe(me.id);
		});
	}
}
