import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchEmoji_ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireRolePolicy: 'canManageCustomEmojis',
	errors: { noSuchEmoji: noSuchEmoji_ },
} as const;

export const paramDef = z.object({
	id: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private readonly customEmojiService: CustomEmojiService) {
		super(meta, paramDef, async (ps) => {
			await this.customEmojiService.delete(ps.id);
		});
	}
}
