import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireRolePolicy: 'canManageCustomEmojis',
	errors: {
		noSuchEmoji: {
			message: 'No such emoji.',
			code: 'NO_SUCH_EMOJI',
			id: 'be83669b-773a-44b7-b1f8-e5e5170ac3c2',
		},
	},
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
	constructor(private customEmojiService: CustomEmojiService) {
		super(meta, paramDef, async (ps) => {
			await this.customEmojiService.delete(ps.id);
		});
	}
}
