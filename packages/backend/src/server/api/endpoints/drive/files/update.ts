import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { RoleService } from '@/core/RoleService.js';
import { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

const res = DriveFileSchema;
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'write:drive',
	description: 'Update the properties of a drive file.',
	errors: {
		invalidFileName: {
			message: 'Invalid file name.',
			code: 'INVALID_FILE_NAME',
			id: '395e7156-f9f0-475e-af89-53c3c23080c2',
		},
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'e7778c7e-3af9-49cd-9690-6dbc3e6c972d',
		},
		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: '01a53b27-82fc-445b-a0c1-b558465a8ed2',
		},
		noSuchFolder: {
			message: 'No such folder.',
			code: 'NO_SUCH_FOLDER',
			id: 'ea8fb7a5-af77-4a08-b608-c0218176cd73',
		},
		restrictedByRole: {
			message: 'This feature is restricted by your role.',
			code: 'RESTRICTED_BY_ROLE',
			id: '7f59dccb-f465-75ab-5cf4-3ce44e3282f7',
		},
	},
	res,
} as const;

export const paramDef = z.object({
	fileId: MisskeyIdSchema,
	folderId: MisskeyIdSchema.nullable().optional(),
	name: z.string().optional(),
	isSensitive: z.boolean().optional(),
	comment: z.string().max(512).nullable().optional(),
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
		private readonly roleService: RoleService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const file = await this.prismaService.client.drive_file.findUnique({
				where: { id: ps.fileId },
			});
			const alwaysMarkNsfw = (await this.roleService.getUserPolicies(me.id))
				.alwaysMarkNsfw;
			if (file == null) {
				throw new ApiError(meta.errors.noSuchFile);
			}

			if (!(await this.roleService.isModerator(me)) && file.userId !== me.id) {
				throw new ApiError(meta.errors.accessDenied);
			}

			if (ps.name) file.name = ps.name;
			if (!this.driveFileEntityService.validateFileName(file.name)) {
				throw new ApiError(meta.errors.invalidFileName);
			}

			if (ps.comment !== undefined) file.comment = ps.comment;

			if (
				ps.isSensitive !== undefined &&
				ps.isSensitive !== file.isSensitive &&
				alwaysMarkNsfw &&
				!ps.isSensitive
			) {
				throw new ApiError(meta.errors.restrictedByRole);
			}

			if (ps.isSensitive !== undefined) file.isSensitive = ps.isSensitive;

			if (ps.folderId !== undefined) {
				if (ps.folderId === null) {
					file.folderId = null;
				} else {
					const folder = await this.prismaService.client.drive_folder.findUnique({
						where: {
							id: ps.folderId,
							userId: me.id,
						},
					});

					if (folder == null) {
						throw new ApiError(meta.errors.noSuchFolder);
					}

					file.folderId = folder.id;
				}
			}

			await this.prismaService.client.drive_file.update({
				where: { id: file.id },
				data: {
					name: file.name,
					comment: file.comment,
					folderId: file.folderId,
					isSensitive: file.isSensitive,
				},
			});

			const fileObj = await this.driveFileEntityService.pack(file, {
				self: true,
			});

			// Publish fileUpdated event
			this.globalEventService.publishDriveStream(me.id, 'fileUpdated', fileObj);

			return fileObj satisfies z.infer<typeof res>;
		});
	}
}
