import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { AppSchema } from '@/models/zod/AppSchema.js';
import { AppEntityService } from './AppEntityService.js';
import type { auth_session, user } from '@prisma/client';
import type { z } from 'zod';

@Injectable()
export class AuthSessionEntityService {
	constructor(
		private readonly appEntityService: AppEntityService,
		private readonly prismaService: PrismaService
	) {}

	/**
	 * `auth_session`をpackする。
	 *
	 * @param src
	 * @param me
	 * @returns `app`に`secret`は含まれない。
	 */
	@bindThis
	public async pack(
		src: auth_session['id'] | auth_session,
		me?: { id: user['id'] } | null | undefined,
	): Promise<{ id: string; app: z.infer<typeof AppSchema>; token: string }> {
		const session = typeof src === 'object'
			? src
			: await this.prismaService.client.auth_session.findUniqueOrThrow({ where: { id: src } });

		return {
			id: session.id,
			app: await this.appEntityService.pack(session.appId, me),
			token: session.token,
		};
	}
}
