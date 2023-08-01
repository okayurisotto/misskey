import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import type { DriveFilesRepository, UsersRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { md5Pattern, misskeyIdPattern } from '@/models/zod/misc.js';
import { ApiError } from '../../../error.js';

const res = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	userId: misskeyIdPattern.nullable(),
	userHost: z
		.string()
		.nullable()
		.describe('The local host is represented with `null`.'),
	md5: md5Pattern,
	name: z.string(),
	type: z.string(),
	size: z.number(),
	comment: z.string().nullable(),
	blurhash: z.string().nullable(),
	properties: z.unknown(),
	storedInternal: z.boolean().nullable(),
	url: z.string().url().nullable(),
	thumbnailUrl: z.string().url().nullable(),
	webpublicUrl: z.string().url().nullable(),
	accessKey: z.string().nullable(),
	thumbnailAccessKey: z.string().nullable(),
	webpublicAccessKey: z.string().nullable(),
	uri: z.string().nullable(),
	src: z.string().nullable(),
	folderId: misskeyIdPattern.nullable(),
	isSensitive: z.boolean(),
	isLink: z.boolean(),
});
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: {
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'caf3ca38-c6e5-472e-a30c-b05377dcc240',
		},
	},
	res,
} as const;

export const paramDef = z.union([
	z.object({ fileId: misskeyIdPattern }),
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
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const file =
				'fileId' in ps
					? await this.driveFilesRepository.findOneBy({ id: ps.fileId })
					: await this.driveFilesRepository.findOne({
							where: [
								{ url: ps.url },
								{ thumbnailUrl: ps.url },
								{ webpublicUrl: ps.url },
							],
					  });

			if (file == null) {
				throw new ApiError(meta.errors.noSuchFile);
			}

			const owner = file.userId
				? await this.usersRepository.findOneByOrFail({ id: file.userId })
				: null;

			const iAmModerator = await this.roleService.isModerator(me);
			const ownerIsModerator = owner
				? await this.roleService.isModerator(owner)
				: false;

			return {
				id: file.id,
				userId: file.userId,
				userHost: file.userHost,
				isLink: file.isLink,
				maybePorn: file.maybePorn,
				maybeSensitive: file.maybeSensitive,
				isSensitive: file.isSensitive,
				folderId: file.folderId,
				src: file.src,
				uri: file.uri,
				webpublicAccessKey: file.webpublicAccessKey,
				thumbnailAccessKey: file.thumbnailAccessKey,
				accessKey: file.accessKey,
				webpublicType: file.webpublicType,
				webpublicUrl: file.webpublicUrl,
				thumbnailUrl: file.thumbnailUrl,
				url: file.url,
				storedInternal: file.storedInternal,
				properties: file.properties,
				blurhash: file.blurhash,
				comment: file.comment,
				size: file.size,
				type: file.type,
				name: file.name,
				md5: file.md5,
				createdAt: file.createdAt.toISOString(),
				requestIp: iAmModerator ? file.requestIp : null,
				requestHeaders:
					iAmModerator && !ownerIsModerator ? file.requestHeaders : null,
			} satisfies z.infer<typeof res>;
		});
	}
}
