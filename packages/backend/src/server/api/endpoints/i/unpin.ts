import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { NotePiningService } from '@/core/NotePiningService.js';
import { MeDetailedSchema } from '@/models/zod/MeDetailedSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

const res = MeDetailedSchema;
export const meta = {
	tags: ['account', 'notes'],
	requireCredential: true,
	kind: 'write:account',
	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '454170ce-9d63-4a43-9da1-ea10afe81e21',
		},
	},
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	noteId: misskeyIdPattern,
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		private userEntityService: UserEntityService,
		private notePiningService: NotePiningService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			await this.notePiningService.removePinned(me, ps.noteId).catch((err) => {
				if (err.id === 'b302d4cf-c050-400a-bbb3-be208681f40c') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});

			return (await this.userEntityService.pack<true, true>(me.id, me, {
				detail: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
