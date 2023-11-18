import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { CustomEmojiDeleteService } from '@/core/CustomEmojiDeleteService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireRolePolicy: 'canManageCustomEmojis',
} as const;

export const paramDef = z.object({
	ids: z.array(MisskeyIdSchema),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly customEmojiDeleteService: CustomEmojiDeleteService,
	) {
		super(meta, paramDef, async (ps) => {
			await this.customEmojiDeleteService.deleteBulk(ps.ids);
		});
	}
}
