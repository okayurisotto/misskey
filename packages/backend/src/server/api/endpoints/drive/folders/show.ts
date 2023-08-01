import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
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
	res: generateSchema(res),
	errors: {
		noSuchFolder: {
			message: 'No such folder.',
			code: 'NO_SUCH_FOLDER',
			id: 'd74ab9eb-bb09-4bba-bf24-fb58f761e1e9',
		},
	},
} as const;

const paramDef_ = z.object({
	folderId: misskeyIdPattern,
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
	) {
		super(meta, paramDef_, async (ps, me) => {
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
