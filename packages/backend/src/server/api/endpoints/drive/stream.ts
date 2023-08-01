import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { DriveFilesRepository } from '@/models/index.js';
import { QueryService } from '@/core/QueryService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { DI } from '@/di-symbols.js';
import { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(DriveFileSchema);
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
	type: z
		.string()
		.regex(/^[a-zA-Z\/\-*]+$/)
		.optional(),
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
		private queryService: QueryService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.driveFilesRepository.createQueryBuilder('file'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('file.userId = :userId', { userId: me.id });

			if (ps.type) {
				if (ps.type.endsWith('/*')) {
					query.andWhere('file.type like :type', {
						type: ps.type.replace('/*', '/') + '%',
					});
				} else {
					query.andWhere('file.type = :type', { type: ps.type });
				}
			}

			const files = await query.limit(ps.limit).getMany();

			return (await this.driveFileEntityService.packMany(files, {
				detail: false,
				self: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
