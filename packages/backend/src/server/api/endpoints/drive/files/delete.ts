import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchFile______, accessDenied___ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { RoleService } from '@/core/RoleService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { DriveFileDeleteService } from '@/core/DriveFileDeleteService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'write:drive',
	description: 'Delete an existing drive file.',
	errors: { noSuchFile: noSuchFile______, accessDenied: accessDenied___ },
} as const;

export const paramDef = z.object({
	fileId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly roleService: RoleService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
		private readonly driveFileDeleteService: DriveFileDeleteService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const file = await this.prismaService.client.driveFile.findUnique({
				where: { id: ps.fileId },
			});

			if (file == null) {
				throw new ApiError(meta.errors.noSuchFile);
			}

			if (!(await this.roleService.isModerator(me)) && file.userId !== me.id) {
				throw new ApiError(meta.errors.accessDenied);
			}

			// Delete
			await this.driveFileDeleteService.delete(file);

			// Publish fileDeleted event
			this.globalEventService.publishDriveStream(me.id, 'fileDeleted', file.id);
		});
	}
}
