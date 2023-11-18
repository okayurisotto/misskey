import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { CustomEmojiCategoryService } from '@/core/CustomEmojiCategoryService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireRolePolicy: 'canManageCustomEmojis',
} as const;

export const paramDef = z.object({
	ids: z.array(MisskeyIdSchema),
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
	constructor(
		private readonly customEmojiCategoryService: CustomEmojiCategoryService,
	) {
		super(meta, paramDef, async (ps) => {
			await this.customEmojiCategoryService.setBulk(
				ps.ids,
				ps.category ?? null,
			);
		});
	}
}
