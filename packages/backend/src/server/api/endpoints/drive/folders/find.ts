import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFolderEntityService } from '@/core/entities/DriveFolderEntityService.js';
import { DriveFolderSchema } from '@/models/zod/DriveFolderSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(DriveFolderSchema);
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'read:drive',
	res,
} as const;

export const paramDef = z.object({
	name: z.string(),
	parentId: MisskeyIdSchema.nullable().default(null),
});

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
	) {
		super(meta, paramDef, async (ps, me) => {
			const folders = await this.prismaService.client.driveFolder.findMany({
				where: {
					name: ps.name,
					userId: me.id,
					parentId: ps.parentId ?? null,
				},
			});

			return await Promise.all(
				folders.map((folder) => this.driveFolderEntityService.pack(folder)),
			);
		});
	}
}
