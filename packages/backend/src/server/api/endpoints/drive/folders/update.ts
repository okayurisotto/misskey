import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import {
	noSuchFolder____,
	noSuchParentFolder,
	recursiveNesting,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFolderEntityService } from '@/core/entities/DriveFolderEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DriveFolderSchema } from '@/models/zod/DriveFolderSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

const res = DriveFolderSchema;
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'write:drive',
	errors: {
		noSuchFolder: noSuchFolder____,
		noSuchParentFolder: noSuchParentFolder,
		recursiveNesting: recursiveNesting,
	},
	res,
} as const;

export const paramDef = z.object({
	folderId: MisskeyIdSchema,
	name: z.string().max(200).optional(),
	parentId: MisskeyIdSchema.nullable().optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly driveFolderEntityService: DriveFolderEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Fetch folder
			const folder = await this.prismaService.client.driveFolder.findUnique({
				where: {
					id: ps.folderId,
					userId: me.id,
				},
			});

			if (folder == null) {
				throw new ApiError(meta.errors.noSuchFolder);
			}

			if (ps.name) folder.name = ps.name;

			if (ps.parentId !== undefined) {
				if (ps.parentId === folder.id) {
					throw new ApiError(meta.errors.recursiveNesting);
				} else if (ps.parentId === null) {
					folder.parentId = null;
				} else {
					// Get parent folder
					const parent =
						await this.prismaService.client.driveFolder.findUnique({
							where: {
								id: ps.parentId,
								userId: me.id,
							},
						});

					if (parent == null) {
						throw new ApiError(meta.errors.noSuchParentFolder);
					}

					// Check if the circular reference will occur
					const checkCircle = async (folderId: string): Promise<boolean> => {
						// Fetch folder
						const folder2 =
							await this.prismaService.client.driveFolder.findUnique({
								where: {
									id: folderId,
								},
							});

						if (folder2!.id === folder.id) {
							return true;
						} else if (folder2!.parentId) {
							return await checkCircle(folder2!.parentId);
						} else {
							return false;
						}
					};

					if (parent.parentId !== null) {
						if (await checkCircle(parent.parentId)) {
							throw new ApiError(meta.errors.recursiveNesting);
						}
					}

					folder.parentId = parent.id;
				}
			}

			// Update
			await this.prismaService.client.driveFolder.update({
				where: { id: folder.id },
				data: {
					name: folder.name,
					parentId: folder.parentId,
				},
			});

			const folderObj = await this.driveFolderEntityService.pack(folder);

			// Publish folderUpdated event
			this.globalEventService.publishDriveStream(
				me.id,
				'folderUpdated',
				folderObj,
			);

			return folderObj;
		});
	}
}
