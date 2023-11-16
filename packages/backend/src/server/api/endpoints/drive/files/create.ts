import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import {
	invalidFileName,
	inappropriate,
	noFreeSpace,
} from '@/server/api/errors.js';
import { DB_MAX_IMAGE_COMMENT_LENGTH } from '@/const.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { MetaService } from '@/core/MetaService.js';
import { DriveService } from '@/core/DriveService.js';
import { DriveFileSchema } from '@/models/zod/DriveFileSchema.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

const res = DriveFileSchema;
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	prohibitMoved: true,
	limit: {
		duration: ms('1hour'),
		max: 120,
	},
	requireFile: true,
	kind: 'write:drive',
	description: 'Upload a new drive file.',
	res,
	errors: {
		invalidFileName: invalidFileName,
		inappropriate: inappropriate,
		noFreeSpace: noFreeSpace,
	},
} as const;

export const paramDef = z.object({
	folderId: MisskeyIdSchema.nullable().default(null),
	name: z.string().nullable().default(null),
	comment: z.string().max(DB_MAX_IMAGE_COMMENT_LENGTH).nullable().default(null),
	isSensitive: z.boolean().default(false),
	force: z.boolean().default(false),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private driveFileEntityService: DriveFileEntityService,
		private metaService: MetaService,
		private driveService: DriveService,
	) {
		super(meta, paramDef, async (ps, me, _, file, cleanup, ip, headers) => {
			// Get 'name' parameter
			let name = ps.name ?? file!.name ?? null;
			if (name != null) {
				name = name.trim();
				if (name.length === 0) {
					name = null;
				} else if (name === 'blob') {
					name = null;
				} else if (!this.driveFileEntityService.validateFileName(name)) {
					throw new ApiError(meta.errors.invalidFileName);
				}
			}

			const instance = await this.metaService.fetch();

			try {
				// Create file
				const driveFile = await this.driveService.addFile({
					user: me,
					path: file!.path,
					name,
					comment: ps.comment,
					folderId: ps.folderId,
					force: ps.force,
					sensitive: ps.isSensitive,
					requestIp: instance.enableIpLogging ? ip : null,
					requestHeaders: instance.enableIpLogging ? headers : null,
				});
				return await this.driveFileEntityService.pack(driveFile, {
					self: true,
				});
			} catch (err) {
				if (err instanceof Error || typeof err === 'string') {
					console.error(err);
				}
				if (err instanceof IdentifiableError) {
					if (err.id === '282f77bf-5816-4f72-9264-aa14d8261a21') {
						throw new ApiError(meta.errors.inappropriate);
					}
					if (err.id === 'c6244ed2-a39a-4e1c-bf93-f0fbd7764fa6') {
						throw new ApiError(meta.errors.noFreeSpace);
					}
				}
				throw new ApiError();
			} finally {
				cleanup!();
			}
		});
	}
}
