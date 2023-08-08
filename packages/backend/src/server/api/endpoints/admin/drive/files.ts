import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(DriveFileSchema);
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z.object({
	limit: z.number().int().min(1).max(100).default(10),
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
	userId: MisskeyIdSchema.nullable().optional(),
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
		private readonly driveFileEntityService: DriveFileEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});
			const files = await this.prismaService.client.drive_file.findMany({
				where: {
					AND: [
						paginationQuery.where,
						ps.userId
							? { userId: ps.userId }
							: {
									AND: [
										ps.origin === 'local' ? { userHost: null } : {},
										ps.origin === 'remote' ? { userHost: { not: null } } : {},
										ps.hostname ? { userHost: ps.hostname } : {},
									],
							  },
						ps.type
							? ps.type.endsWith('/*')
								? { type: { endsWith: ps.type.replace(/\/\*$/, '/') } }
								: { type: ps.type }
							: {},
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return (await this.driveFileEntityService.packMany(files, {
				detail: true,
				withUser: true,
				self: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
