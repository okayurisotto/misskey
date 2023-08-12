import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';
import { EmojiDetailedSchema } from '@/models/zod/EmojiDetailedSchema.js';

const res = EmojiDetailedSchema; // TODO
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireRolePolicy: 'canManageCustomEmojis',
	res,
	errors: {
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'fc46b5a4-6b92-4c33-ac66-b806659bb5cf',
		},
	},
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
		private readonly customEmojiService: CustomEmojiService,
		private readonly emojiEntityService: EmojiEntityService,
		private readonly moderationLogService: ModerationLogService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const driveFile = await this.prismaService.client.drive_file.findUnique({
				where: { id: ps.fileId },
			});
			if (driveFile === null) throw new ApiError(meta.errors.noSuchFile);

			const emoji = await this.customEmojiService.add({
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

			this.moderationLogService.insertModerationLog(me, 'addEmoji', {
				emojiId: emoji.id,
			});

			return (await this.emojiEntityService.packDetailed(
				emoji,
			)) satisfies z.infer<typeof res>;
		});
	}
}
