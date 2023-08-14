import { Injectable } from '@nestjs/common';
import type { AppSchema } from '@/models/zod/AppSchema.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { z } from 'zod';
import type { app, user } from '@prisma/client';

@Injectable()
export class AppEntityService {
	constructor(private readonly prismaService: PrismaService) {}

	/**
	 * `app`をpackする。
	 *
	 * @param src
	 * @param me                             渡された場合、返り値には`isAuthorized`が含まれる。
	 * @param options.detail                 使われていない。
	 * @param options.includeSecret
	 * @param options.includeProfileImageIds 使われていない。
	 * @returns
	 */
	@bindThis
	public async pack(
		src: app['id'] | app,
		me?: { id: user['id'] } | null | undefined,
		options?: {
			detail?: boolean,
			includeSecret?: boolean,
			includeProfileImageIds?: boolean
		},
	): Promise<z.infer<typeof AppSchema>> {
		const opts = {
			detail: false,
			includeSecret: false,
			includeProfileImageIds: false,
			...options,
		};

		const app = typeof src === 'object'
			? src
			: await this.prismaService.client.app.findUniqueOrThrow({ where: { id: src } });

		return {
			id: app.id,
			name: app.name,
			callbackUrl: app.callbackUrl,
			permission: app.permission,
			...(opts.includeSecret ? { secret: app.secret } : {}),
			...(me ? {
				isAuthorized: await this.prismaService.client.access_token.count({
					where: {
						appId: app.id,
						userId: me.id,
					},
					take: 1,
				}).then(count => count > 0),
			} : {}),
		};
	}
}
