import { Injectable } from '@nestjs/common';
import type { AppSchema } from '@/models/zod/AppSchema.js';
import type { App } from '@/models/entities/App.js';
import type { User } from '@/models/entities/User.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { z } from 'zod';
import type { app } from '@prisma/client';

@Injectable()
export class AppEntityService {
	constructor(private readonly prismaService: PrismaService) {}

	@bindThis
	public async pack(
		src: App['id'] | app,
		me?: { id: User['id'] } | null | undefined,
		options?: {
			detail?: boolean,
			includeSecret?: boolean,
			includeProfileImageIds?: boolean
		},
	): Promise<z.infer<typeof AppSchema>> {
		const opts = Object.assign({
			detail: false,
			includeSecret: false,
			includeProfileImageIds: false,
		}, options);

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
