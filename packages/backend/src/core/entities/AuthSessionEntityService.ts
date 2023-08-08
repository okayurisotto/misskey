import { Injectable } from '@nestjs/common';
import type { AuthSession } from '@/models/entities/AuthSession.js';
import type { User } from '@/models/entities/User.js';
import { bindThis } from '@/decorators.js';
import type { T2P } from '@/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import { AppEntityService } from './AppEntityService.js';
import type { auth_session } from '@prisma/client';

@Injectable()
export class AuthSessionEntityService {
	constructor(
		private readonly appEntityService: AppEntityService,
		private readonly prismaService: PrismaService
	) {}

	@bindThis
	public async pack(
		src: AuthSession['id'] | T2P<AuthSession, auth_session>,
		me?: { id: User['id'] } | null | undefined,
	) {
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
