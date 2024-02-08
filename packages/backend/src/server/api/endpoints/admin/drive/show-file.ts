import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import { noSuchFile } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { RoleService } from '@/core/RoleService.js';
import { MD5Schema, MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

const RequestHeadersSchema = z.record(z.string(), z.string()).nullable();

const res = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	userId: MisskeyIdSchema.nullable(),
	userHost: z
		.string()
		.nullable()
		.describe('The local host is represented with `null`.'),
	md5: MD5Schema,
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
	folderId: MisskeyIdSchema.nullable(),
	isSensitive: z.boolean(),
	isLink: z.boolean(),

	maybePorn: z.boolean(),
	maybeSensitive: z.boolean(),
	webpublicType: z.string().nullable(),
	requestIp: z.string().nullable(),
	requestHeaders: RequestHeadersSchema,
});
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	errors: { noSuchFile: noSuchFile },
	res,
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
		private readonly roleService: RoleService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const file =
				'fileId' in ps
					? await this.prismaService.client.driveFile.findUnique({
							where: { id: ps.fileId },
							include: { user: true },
					  })
					: await this.prismaService.client.driveFile.findFirst({
							where: {
								OR: [
									{ url: ps.url },
									{ thumbnailUrl: ps.url },
									{ webpublicUrl: ps.url },
								],
							},
							include: { user: true },
					  });

			if (file === null) {
				throw new ApiError(meta.errors.noSuchFile);
			}

			const [iAmModerator, ownerIsModerator] = await Promise.all([
				this.roleService.isModerator(me),
				(async (): Promise<boolean> =>
					file.user ? await this.roleService.isModerator(file.user) : false)(),
			]);

			return {
				...pick(file, [
					'id',
					'userId',
					'userHost',
					'isLink',
					'maybePorn',
					'maybeSensitive',
					'isSensitive',
					'folderId',
					'src',
					'uri',
					'webpublicAccessKey',
					'thumbnailAccessKey',
					'accessKey',
					'webpublicType',
					'webpublicUrl',
					'thumbnailUrl',
					'url',
					'storedInternal',
					'properties',
					'blurhash',
					'comment',
					'size',
					'type',
					'name',
					'md5',
				]),
				createdAt: file.createdAt.toISOString(),
				requestIp: iAmModerator ? file.requestIp : null,
				requestHeaders:
					iAmModerator && !ownerIsModerator
						? RequestHeadersSchema.parse(file.requestHeaders)
						: null,
			};
		});
	}
}
