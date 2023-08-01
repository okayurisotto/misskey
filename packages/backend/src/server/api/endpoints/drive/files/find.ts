import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { DriveFilesRepository } from '@/models/index.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { DI } from '@/di-symbols.js';
import { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(DriveFileSchema);
export const meta = {
	requireCredential: true,
	tags: ['drive'],
	kind: 'read:drive',
	description: 'Search for a drive file by the given parameters.',
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	name: z.string(),
	folderId: misskeyIdPattern.nullable().default(null),
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
				name: ps.name,
				userId: me.id,
				folderId: ps.folderId ?? IsNull(),
			});

			return (await Promise.all(
				files.map((file) =>
					this.driveFileEntityService.pack(file, { self: true }),
				),
			)) satisfies z.infer<typeof res>;
		});
	}
}
