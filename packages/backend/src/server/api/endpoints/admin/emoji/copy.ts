import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import type { DriveFile } from '@/models/entities/DriveFile.js';
import { DriveService } from '@/core/DriveService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import type { T2P } from '@/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';
import type { drive_file } from '@prisma/client';

const res = z.object({ id: MisskeyIdSchema });
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireRolePolicy: 'canManageCustomEmojis',
	errors: {
		noSuchEmoji: {
			message: 'No such emoji.',
			code: 'NO_SUCH_EMOJI',
			id: 'e2785b66-dca3-4087-9cac-b93c541cc425',
		},
	},
	res,
} as const;

export const paramDef = z.object({ emojiId: MisskeyIdSchema });

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly emojiEntityService: EmojiEntityService,
		private readonly idService: IdService,
		private readonly globalEventService: GlobalEventService,
		private readonly driveService: DriveService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const emoji = await this.prismaService.client.emoji.findUnique({
				where: { id: ps.emojiId },
			});

			if (emoji == null) {
				throw new ApiError(meta.errors.noSuchEmoji);
			}

			let driveFile: T2P<DriveFile, drive_file>;

			try {
				// Create file
				driveFile = await this.driveService.uploadFromUrl({
					url: emoji.originalUrl,
					user: null,
					force: true,
				});
			} catch (e) {
				throw new ApiError();
			}

			const copied = await this.prismaService.client.emoji.create({
				data: {
					id: this.idService.genId(),
					updatedAt: new Date(),
					name: emoji.name,
					host: null,
					aliases: [],
					originalUrl: driveFile.url,
					publicUrl: driveFile.webpublicUrl ?? driveFile.url,
					type: driveFile.webpublicType ?? driveFile.type,
					license: emoji.license,
				},
			});

			this.globalEventService.publishBroadcastStream('emojiAdded', {
				emoji: await this.emojiEntityService.packDetailed(copied.id),
			});

			return {
				id: copied.id,
			} satisfies z.infer<typeof res>;
		});
	}
}
