import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import {
	invalidFileName_,
	noSuchFile________,
	accessDenied_____,
	noSuchFolder,
	restrictedByRole,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFileEntityPackService } from '@/core/entities/DriveFileEntityPackService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { RoleService } from '@/core/RoleService.js';
import { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { DriveFileNameValidationService } from '@/core/entities/DriveFileNameValidationService.js';
import { ApiError } from '../../../error.js';

const res = DriveFileSchema;
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'write:drive',
	description: 'Update the properties of a drive file.',
	errors: {
		invalidFileName: invalidFileName_,
		noSuchFile: noSuchFile________,
		accessDenied: accessDenied_____,
		noSuchFolder: noSuchFolder,
		restrictedByRole: restrictedByRole,
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
		private readonly driveFileEntityPackService: DriveFileEntityPackService,
		private readonly roleService: RoleService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
		private readonly driveFileNameValidationService: DriveFileNameValidationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const file = await this.prismaService.client.driveFile.findUnique({
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
			if (!this.driveFileNameValidationService.validate(file.name)) {
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
					const folder =
						await this.prismaService.client.drive_folder.findUnique({
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

			await this.prismaService.client.driveFile.update({
				where: { id: file.id },
				data: {
					name: file.name,
					comment: file.comment,
					folderId: file.folderId,
					isSensitive: file.isSensitive,
				},
			});

			const fileObj = await this.driveFileEntityPackService.pack(file, {
				self: true,
			});

			// Publish fileUpdated event
			this.globalEventService.publishDriveStream(me.id, 'fileUpdated', fileObj);

			return fileObj;
		});
	}
}
