import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { drive_file } from '@prisma/client';
import { noSuchEmoji__, noSuchFile__, sameNameEmojiExists } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { CustomEmojiService } from '@/core/CustomEmojiService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireRolePolicy: 'canManageCustomEmojis',
	errors: {noSuchEmoji:noSuchEmoji__,noSuchFile:noSuchFile__,sameNameEmojiExists:sameNameEmojiExists},
} as const;

export const paramDef = z.object({
	id: MisskeyIdSchema,
	name: z.string().regex(/^[a-zA-Z0-9_]+$/),
	fileId: MisskeyIdSchema.optional(),
	category: z
		.string()
		.nullable()
		.optional()
		.describe('Use `null` to reset the category.'),
	aliases: z.array(z.string()),
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
	z.ZodType<void>
> {
	constructor(
		private readonly customEmojiService: CustomEmojiService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const driveFile = await (async (): Promise<drive_file | undefined> => {
				if (!ps.fileId) return undefined;

				const result = await this.prismaService.client.drive_file.findUnique({
					where: { id: ps.fileId },
				});
				if (result === null) {
					throw new ApiError(meta.errors.noSuchFile);
				}

				return result;
			})();

			await this.customEmojiService.update(ps.id, {
				driveFile,
				name: ps.name,
				category: ps.category ?? null,
				aliases: ps.aliases,
				license: ps.license ?? null,
				isSensitive: ps.isSensitive,
				localOnly: ps.localOnly,
				roleIdsThatCanBeUsedThisEmojiAsReaction:
					ps.roleIdsThatCanBeUsedThisEmojiAsReaction,
			});
		});
	}
}
