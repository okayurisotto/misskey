import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFileEntityPackService } from '@/core/entities/DriveFileEntityPackService.js';
import { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { MD5Schema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(DriveFileSchema);
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'read:drive',
	description: 'Search for a drive file by a hash of the contents.',
	res,
} as const;

export const paramDef = z.object({
	md5: MD5Schema,
});

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
	) {
		super(meta, paramDef, async (ps, me) => {
			const files = await this.prismaService.client.driveFile.findMany({
				where: {
					md5: ps.md5,
					userId: me.id,
				},
			});

			return await this.driveFileEntityPackService.packMany(files, {
				self: true,
			});
		});
	}
}
