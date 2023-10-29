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
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async pack(
		src: auth_session,
		me?: Pick<user, 'id'> | null | undefined,
	): Promise<{ id: string; app: z.infer<typeof AppSchema>; token: string }> {
		const session =
			await this.prismaService.client.auth_session.findUniqueOrThrow({
				where: { id: src.id },
				include: { app: true },
			});

		return {
			id: session.id,
			app: await this.appEntityService.pack(session.app, me),
			token: session.token,
		};
	}
}
