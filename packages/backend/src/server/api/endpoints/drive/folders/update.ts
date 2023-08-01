import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { DriveFoldersRepository } from '@/models/index.js';
import { DriveFolderEntityService } from '@/core/entities/DriveFolderEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DI } from '@/di-symbols.js';
import { DriveFolderSchema } from '@/models/zod/DriveFolderSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

const res = DriveFolderSchema;
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'write:drive',
	errors: {
		noSuchFolder: {
			message: 'No such folder.',
			code: 'NO_SUCH_FOLDER',
			id: 'f7974dac-2c0d-4a27-926e-23583b28e98e',
		},
		noSuchParentFolder: {
			message: 'No such parent folder.',
			code: 'NO_SUCH_PARENT_FOLDER',
			id: 'ce104e3a-faaf-49d5-b459-10ff0cbbcaa1',
		},
		recursiveNesting: {
			message: 'It can not be structured like nesting folders recursively.',
			code: 'RECURSIVE_NESTING',
			id: 'dbeb024837894013aed44279f9199740',
		},
	},
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	folderId: misskeyIdPattern,
	name: z.string().max(200).optional(),
	parentId: misskeyIdPattern.nullable().optional(),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.driveFoldersRepository)
		private driveFoldersRepository: DriveFoldersRepository,

		private driveFolderEntityService: DriveFolderEntityService,
		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			// Fetch folder
			const folder = await this.driveFoldersRepository.findOneBy({
				id: ps.folderId,
				userId: me.id,
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
					const parent = await this.driveFoldersRepository.findOneBy({
						id: ps.parentId,
						userId: me.id,
					});

					if (parent == null) {
						throw new ApiError(meta.errors.noSuchParentFolder);
					}

					// Check if the circular reference will occur
					const checkCircle = async (folderId: string): Promise<boolean> => {
						// Fetch folder
						const folder2 = await this.driveFoldersRepository.findOneBy({
							id: folderId,
						});

						if (folder2!.id === folder!.id) {
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
			this.driveFoldersRepository.update(folder.id, {
				name: folder.name,
				parentId: folder.parentId,
			});

			const folderObj = await this.driveFolderEntityService.pack(folder);

			// Publish folderUpdated event
			this.globalEventService.publishDriveStream(
				me.id,
				'folderUpdated',
				folderObj,
			);

			return folderObj satisfies z.infer<typeof res>;
		});
	}
}
