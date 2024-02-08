import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { noSuchFolder_ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { DriveFolderEntityService } from '@/core/entities/DriveFolderEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DriveFolderSchema } from '@/models/zod/DriveFolderSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

const res = DriveFolderSchema;
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'write:drive',
	limit: {
		duration: ms('1hour'),
		max: 10,
	},
	errors: { noSuchFolder: noSuchFolder_ },
	res,
} as const;

export const paramDef = z.object({
	name: z.string().max(200).default('Untitled'),
	parentId: MisskeyIdSchema.nullable().optional(),
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
		private readonly idService: IdService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// If the parent folder is specified
			let parent = null;
			if (ps.parentId) {
				// Fetch parent folder
				parent = await this.prismaService.client.driveFolder.findUnique({
					where: {
						id: ps.parentId,
						userId: me.id,
					},
				});

				if (parent == null) {
					throw new ApiError(meta.errors.noSuchFolder);
				}
			}

			// Create folder
			const folder = await this.prismaService.client.driveFolder.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					name: ps.name,
					parentId: parent !== null ? parent.id : null,
					userId: me.id,
				},
			});

			const folderObj = await this.driveFolderEntityService.pack(folder);

			// Publish folderCreated event
			this.globalEventService.publishDriveStream(
				me.id,
				'folderCreated',
				folderObj,
			);

			return folderObj;
		});
	}
}
