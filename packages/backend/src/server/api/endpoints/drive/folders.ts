import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFolderEntityService } from '@/core/entities/DriveFolderEntityService.js';
import { DriveFolderSchema } from '@/models/zod/DriveFolderSchema.js';
import { MisskeyIdSchema, PaginationSchema, limit } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { PrismaQueryService } from '@/core/PrismaQueryService.js';

const res = z.array(DriveFolderSchema);
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
		private readonly driveFolderEntityService: DriveFolderEntityService,
		private readonly prismaService: PrismaService,
		private readonly prismaQueryService: PrismaQueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const paginationQuery = this.prismaQueryService.getPaginationQuery({
				sinceId: ps.sinceId,
				untilId: ps.untilId,
			});

			const folders = await this.prismaService.client.driveFolder.findMany({
				where: {
					AND: [
						paginationQuery.where,
						{ userId: me.id },
						ps.folderId ? { parentId: ps.folderId } : { parentId: null },
					],
				},
				orderBy: paginationQuery.orderBy,
				take: ps.limit,
			});

			return await Promise.all(
				folders.map((folder) => this.driveFolderEntityService.pack(folder)),
			);
		});
	}
}
