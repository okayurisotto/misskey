import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { DriveFoldersRepository } from '@/models/index.js';
import { DriveFolderEntityService } from '@/core/entities/DriveFolderEntityService.js';
import { DI } from '@/di-symbols.js';
import { DriveFolderSchema } from '@/models/zod/DriveFolderSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

const res = DriveFolderSchema;
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'read:drive',
	res,
	errors: {
		noSuchFolder: {
			message: 'No such folder.',
			code: 'NO_SUCH_FOLDER',
			id: 'd74ab9eb-bb09-4bba-bf24-fb58f761e1e9',
		},
	},
} as const;

export const paramDef = z.object({
	folderId: misskeyIdPattern,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.driveFoldersRepository)
		private driveFoldersRepository: DriveFoldersRepository,

		private driveFolderEntityService: DriveFolderEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Get folder
			const folder = await this.driveFoldersRepository.findOneBy({
				id: ps.folderId,
				userId: me.id,
			});

			if (folder == null) {
				throw new ApiError(meta.errors.noSuchFolder);
			}

			return (await this.driveFolderEntityService.pack(folder, {
				detail: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
