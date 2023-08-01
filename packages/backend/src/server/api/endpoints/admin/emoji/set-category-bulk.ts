import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireRolePolicy: 'canManageCustomEmojis',
} as const;

export const paramDef = z.object({
	ids: z.array(misskeyIdPattern),
	category: z
		.string()
		.nullable()
		.optional()
		.describe('Use `null` to reset the category.'),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private customEmojiService: CustomEmojiService) {
		super(meta, paramDef, async (ps, me) => {
			await this.customEmojiService.setCategoryBulk(
				ps.ids,
				ps.category ?? null,
			);
		});
	}
}
