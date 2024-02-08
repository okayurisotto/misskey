import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFileEntityPackService } from '@/core/entities/DriveFileEntityPackService.js';
import { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';
import type { Prisma } from '@prisma/client';

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
		folderId: MisskeyIdSchema.nullable().default(null),
		type: z
			.string()
			.regex(/^[a-zA-Z/\-*]+$/)
			.nullable()
			.optional(),
		sort: z
			.enum(['+createdAt', '-createdAt', '+name', '-name', '+size', '-size'])
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
			const orderBy = ((): Prisma.DriveFileOrderByWithRelationInput => {
				switch (ps.sort) {
					case '+createdAt':
						return { createdAt: 'desc' };
					case '-createdAt':
						return { createdAt: 'asc' };
					case '+name':
						return { name: 'desc' };
					case '-name':
						return { name: 'asc' };
					case '+size':
						return { size: 'desc' };
					case '-size':
						return { size: 'asc' };
					default:
						return {};
				}
			})();

			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const files = await this.prismaService.client.driveFile.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{ userId: me.id },
						ps.folderId ? { folderId: ps.folderId } : { folderId: null },
						ps.type
							? ps.type.endsWith('/*')
								? { type: { startsWith: ps.type.replace(/\/\*$/, '/') } }
								: { type: ps.type }
							: {},
					],
				},
				orderBy: orderBy,
				take: ps.limit,
			});

			return await this.driveFileEntityPackService.packMany(files, {
				detail: false,
				self: true,
			});
		});
	}
}
