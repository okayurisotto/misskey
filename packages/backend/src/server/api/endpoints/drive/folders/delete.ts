import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchFolder__, hasChildFilesOrFolders } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'write:drive',
	errors: {
		noSuchFolder: noSuchFolder__,
		hasChildFilesOrFolders: hasChildFilesOrFolders,
	},
} as const;

export const paramDef = z.object({
	folderId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Get folder
			const folder = await this.prismaService.client.driveFolder.findUnique({
				where: {
					id: ps.folderId,
					userId: me.id,
				},
			});

			if (folder == null) {
				throw new ApiError(meta.errors.noSuchFolder);
			}

			const [childFoldersCount, childFilesCount] = await Promise.all([
				this.prismaService.client.driveFolder.count({
					where: { parentId: folder.id },
				}),
				this.prismaService.client.driveFile.count({
					where: { folderId: folder.id },
				}),
			]);

			if (childFoldersCount !== 0 || childFilesCount !== 0) {
				throw new ApiError(meta.errors.hasChildFilesOrFolders);
			}

			await this.prismaService.client.driveFolder.delete({
				where: { id: folder.id },
			});

			// Publish folderCreated event
			this.globalEventService.publishDriveStream(
				me.id,
				'folderDeleted',
				folder.id,
			);
		});
	}
}
