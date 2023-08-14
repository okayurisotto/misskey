import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';
import type { drive_file } from '@prisma/client';

const res = DriveFileSchema;
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'read:drive',
	description: 'Show the properties of a drive file.',
	res,
	errors: {
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: '067bc436-2718-4795-b0fb-ecbe43949e31',
		},
		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: '25b73c73-68b1-41d0-bad1-381cfdf6579f',
		},
	},
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
		private readonly driveFileEntityService: DriveFileEntityService,
		private readonly roleService: RoleService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			let file: drive_file | null = null;

			if ('fileId' in ps) {
				file = await this.prismaService.client.drive_file.findUnique({
					where: { id: ps.fileId },
				});
			} else if (ps.url) {
				file = await this.prismaService.client.drive_file.findFirst({
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

			return (await this.driveFileEntityService.pack(file, {
				detail: true,
				withUser: true,
				self: true,
			})) satisfies z.infer<typeof res>;
		});
	}
}
