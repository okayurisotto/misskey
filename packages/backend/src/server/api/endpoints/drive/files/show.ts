import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchFile_______, accessDenied____ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFileEntityPackService } from '@/core/entities/DriveFileEntityPackService.js';
import { RoleService } from '@/core/RoleService.js';
import { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';
import type { DriveFile } from '@prisma/client';

const res = DriveFileSchema;
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'read:drive',
	description: 'Show the properties of a drive file.',
	res,
	errors: { noSuchFile: noSuchFile_______, accessDenied: accessDenied____ },
} as const;

export const paramDef = z.union([
	z.object({ fileId: MisskeyIdSchema }),
	z.object({ url: z.string() }),
]);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly driveFileEntityPackService: DriveFileEntityPackService,
		private readonly roleService: RoleService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let file: DriveFile | null = null;

			if ('fileId' in ps) {
				file = await this.prismaService.client.driveFile.findUnique({
					where: { id: ps.fileId },
				});
			} else if (ps.url) {
				file = await this.prismaService.client.driveFile.findFirst({
					where: {
						OR: [
							{ url: ps.url },
							{ webpublicUrl: ps.url },
							{ thumbnailUrl: ps.url },
						],
					},
				});
			}

			if (file == null) {
				throw new ApiError(meta.errors.noSuchFile);
			}

			if (!(await this.roleService.isModerator(me)) && file.userId !== me.id) {
				throw new ApiError(meta.errors.accessDenied);
			}

			return await this.driveFileEntityPackService.pack(file, {
				detail: true,
				withUser: true,
				self: true,
			});
		});
	}
}
