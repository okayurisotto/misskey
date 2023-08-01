import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type { ClipsRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueryService } from '@/core/QueryService.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { DI } from '@/di-symbols.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';

const res = z.array(ClipSchema);
export const meta = {
	tags: ['users', 'clips'],
	description: 'Show all clips this user owns.',
	res,
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,

		private clipEntityService: ClipEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService
				.makePaginationQuery(
					this.clipsRepository.createQueryBuilder('clip'),
					ps.sinceId,
					ps.untilId,
				)
				.andWhere('clip.userId = :userId', { userId: ps.userId })
				.andWhere('clip.isPublic = true');

			const clips = await query.limit(ps.limit).getMany();

			return (await this.clipEntityService.packMany(
				clips,
				me,
			)) satisfies z.infer<typeof res>;
		});
	}
}
