import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchFolder___ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFolderEntityService } from '@/core/entities/DriveFolderEntityService.js';
import { DriveFolderSchema } from '@/models/zod/DriveFolderSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

const res = DriveFolderSchema;
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'read:drive',
	res,
	errors: { noSuchFolder: noSuchFolder___ },
} as const;

export const paramDef = z.object({
	folderId: MisskeyIdSchema,
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
			// Get folder
			const folder = await this.prismaService.client.driveFolder.findUnique({
				where: {
					id: ps.folderId,
					userId: me.id,
				},
			});

			if (folder == null) {
				throw new ApiError(meta.errors.noSuchFolder);
			}

			return await this.driveFolderEntityService.pack(folder, {
				detail: true,
			});
		});
	}
}
