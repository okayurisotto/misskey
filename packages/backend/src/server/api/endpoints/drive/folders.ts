import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { DriveFoldersRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { DriveFolderEntityService } from '@/core/entities/DriveFolderEntityService.js';
import { DI } from '@/di-symbols.js';
import { DriveFolderSchema } from '@/models/zod/DriveFolderSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(DriveFolderSchema);
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'read:drive',
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
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
		@Inject(DI.driveFoldersRepository)
		private driveFoldersRepository: DriveFoldersRepository,

		private driveFolderEntityService: DriveFolderEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.driveFoldersRepository.createQueryBuilder('folder'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('folder.userId = :userId', { userId: me.id });

			if (ps.folderId) {
				query.andWhere('folder.parentId = :parentId', {
					parentId: ps.folderId,
				});
			} else {
				query.andWhere('folder.parentId IS NULL');
			}

			const folders = await query.limit(ps.limit).getMany();

			return (await Promise.all(
				folders.map((folder) => this.driveFolderEntityService.pack(folder)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
