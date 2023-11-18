import { z } from 'zod';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DriveFileEntityPackService } from '@/core/entities/DriveFileEntityPackService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { DriveFileAddFromUrlService } from '@/core/DriveFileAddFromUrlService.js';

export const meta = {
	tags: ['drive'],
	limit: {
		duration: ms('1hour'),
		max: 60,
	},
	description:
		'Request the server to download a new drive file from the specified URL.',
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:drive',
} as const;

export const paramDef = z.object({
	url: z.string(),
	folderId: MisskeyIdSchema.nullable().default(null),
	isSensitive: z.boolean().default(false),
	comment: z.string().max(512).nullable().default(null),
	marker: z.string().nullable().default(null),
	force: z.boolean().default(false),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly driveFileEntityPackService: DriveFileEntityPackService,
		private readonly globalEventService: GlobalEventService,
		private readonly driveFileAddFromUrlService: DriveFileAddFromUrlService,
	) {
		super(meta, paramDef, async (ps, user, _1, _2, _3, ip, headers) => {
			this.driveFileAddFromUrlService
				.addFromUrl({
					url: ps.url,
					user,
					folderId: ps.folderId,
					sensitive: ps.isSensitive,
					force: ps.force,
					comment: ps.comment,
					requestIp: ip,
					requestHeaders: headers,
				})
				.then((file) => {
					this.driveFileEntityPackService
						.pack(file, { self: true })
						.then((packedFile) => {
							this.globalEventService.publishMainStream(
								user.id,
								'urlUploadFinished',
								{
									marker: ps.marker,
									file: packedFile,
								},
							);
						});
				});
		});
	}
}
