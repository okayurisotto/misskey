import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchFile_ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EmojiDetailedSchema } from '@/models/zod/EmojiDetailedSchema.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { CustomEmojiAddService } from '@/core/CustomEmojiAddService.js';
import { ApiError } from '../../../error.js';

const res = EmojiDetailedSchema; // TODO
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireRolePolicy: 'canManageCustomEmojis',
	res,
	errors: { noSuchFile: noSuchFile_ },
} as const;

export const paramDef = z.object({
	name: z.string().regex(/^[a-zA-Z0-9_]+$/),
	fileId: MisskeyIdSchema,
	category: z
		.string()
		.nullable()
		.optional()
		.describe('Use `null` to reset the category.'),
	aliases: z.array(z.string()).optional(),
	license: z.string().nullable().optional(),
	isSensitive: z.boolean().optional(),
	localOnly: z.boolean().optional(),
	roleIdsThatCanBeUsedThisEmojiAsReaction: z.array(z.string()).optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly customEmojiAddService: CustomEmojiAddService,
		private readonly emojiEntityService: EmojiEntityService,
		private readonly moderationLogService: ModerationLogService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const driveFile = await this.prismaService.client.driveFile.findUnique({
				where: { id: ps.fileId },
			});
			if (driveFile === null) throw new ApiError(meta.errors.noSuchFile);

			const emoji = await this.customEmojiAddService.add({
				driveFile,
				name: ps.name,
				category: ps.category ?? null,
				aliases: ps.aliases ?? [],
				host: null,
				license: ps.license ?? null,
				isSensitive: ps.isSensitive ?? false,
				localOnly: ps.localOnly ?? false,
				roleIdsThatCanBeUsedThisEmojiAsReaction:
					ps.roleIdsThatCanBeUsedThisEmojiAsReaction ?? [],
			});

			await this.moderationLogService.insertModerationLog(me, 'addEmoji', {
				emojiId: emoji.id,
			});

			return this.emojiEntityService.packDetailed(emoji.id, {
				emoji: new EntityMap('id', [emoji]),
			});
		});
	}
}
