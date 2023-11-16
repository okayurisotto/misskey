import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(DriveFileSchema);
export const meta = {
	requireCredential: true,
	tags: ['drive'],
	kind: 'read:drive',
	description: 'Search for a drive file by the given parameters.',
	res,
} as const;

export const paramDef = z.object({
	name: z.string(),
	folderId: MisskeyIdSchema.nullable().default(null),
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
	) {
		super(meta, paramDef, async (ps, me) => {
			const files = await this.prismaService.client.drive_file.findMany({
				where: {
					name: ps.name,
					userId: me.id,
					folderId: ps.folderId ?? null,
				},
			});

			return await Promise.all(
				files.map((file) =>
					this.driveFileEntityService.pack(file, { self: true }),
				),
			);
		});
	}
}
