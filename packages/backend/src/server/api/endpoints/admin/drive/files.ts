import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type { DriveFilesRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
import { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';

const res = z.array(DriveFileSchema);
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: misskeyIdPattern.optional(),
	untilId: misskeyIdPattern.optional(),
	userId: misskeyIdPattern.nullable().optional(),
	type: z
		.string()
		.regex(/^[a-zA-Z0-9\/\-*]+$/)
		.nullable()
		.optional(),
	origin: z.enum(['combined', 'local', 'remote']).default('local'),
	hostname: z
		.string()
		.nullable()
		.default(null)
		.describe('The local host is represented with `null`.'),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private driveFileEntityService: DriveFileEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(
				this.driveFilesRepository.createQueryBuilder('file'),
				ps.sinceId,
				ps.untilId,
			);

			if (ps.userId) {
				query.andWhere('file.userId = :userId', { userId: ps.userId });
			} else {
				if (ps.origin === undefined || ps.origin === 'local') {
					query.andWhere('file.userHost IS NULL');
				} else if (ps.origin === 'remote') {
					query.andWhere('file.userHost IS NOT NULL');
				}

				if (ps.hostname) {
					query.andWhere('file.userHost = :hostname', {
						hostname: ps.hostname,
					});
				}
			}

			if (ps.type) {
				if (ps.type.endsWith('/*')) {
					query.andWhere('file.type like :type', {
						type: ps.type.replace('/*', '/') + '%',
					});
				} else {
					query.andWhere('file.type = :type', { type: ps.type });
				}
			}

			const files = await query.limit(ps.limit ?? 10).getMany();

			return (await this.driveFileEntityService.packMany(files, {
				detail: true,
				withUser: true,
				self: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
