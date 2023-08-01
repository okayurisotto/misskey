import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type { DriveFilesRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { DI } from '@/di-symbols.js';
import { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { md5Pattern } from '@/models/zod/misc.js';

const res = z.array(DriveFileSchema);
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'read:drive',
	description: 'Search for a drive file by a hash of the contents.',
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	md5: md5Pattern,
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
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private driveFileEntityService: DriveFileEntityService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const files = await this.driveFilesRepository.findBy({
				md5: ps.md5,
				userId: me.id,
			});

			return (await this.driveFileEntityService.packMany(files, {
				self: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
