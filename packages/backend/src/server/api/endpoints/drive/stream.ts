import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFileEntityPackService } from '@/core/entities/DriveFileEntityPackService.js';
import { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(DriveFileSchema);
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'read:drive',
	res,
} as const;

export const paramDef = z
	.object({
		limit: limit({ max: 100, default: 10 }),
		type: z
			.string()
			.regex(/^[a-zA-Z/\-*]+$/)
			.optional(),
	})
	.merge(PaginationSchema.pick({ sinceId: true, untilId: true }));

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly driveFileEntityPackService: DriveFileEntityPackService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const files = await this.prismaService.client.driveFile.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{ userId: me.id },
						ps.type
							? ps.type.endsWith('/*')
								? { type: { startsWith: ps.type.replace(/\/\*$/, '/') } }
								: { type: ps.type }
							: {},
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return await this.driveFileEntityPackService.packMany(files, {
				detail: false,
				self: true,
			});
		});
	}
}
