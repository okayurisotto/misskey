import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { CustomEmojiAliasService } from '@/core/CustomEmojiAliasService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireRolePolicy: 'canManageCustomEmojis',
} as const;

export const paramDef = z.object({
	ids: z.array(MisskeyIdSchema),
	aliases: z.array(z.string()),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly customEmojiAliasService: CustomEmojiAliasService,
	) {
		super(meta, paramDef, async (ps) => {
			await this.customEmojiAliasService.removeBulk(ps.ids, ps.aliases);
		});
	}
}
