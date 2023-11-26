import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import type {
	AppIsAuthorizedOnlySchema,
	AppLiteSchema,
} from '@/models/zod/AppSchema.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { AppEntityService } from './AppEntityService.js';
import type { AuthSession, user } from '@prisma/client';
import type { z } from 'zod';

@Injectable()
export class AuthSessionEntityService {
	constructor(
		private readonly appEntityService: AppEntityService,
		private readonly prismaService: PrismaService,
	) {}

	public async pack(
		src: AuthSession,
		me?: Pick<user, 'id'> | null | undefined,
	): Promise<{
		id: string;
		app:
			| z.infer<typeof AppLiteSchema>
			| (z.infer<typeof AppLiteSchema> &
					z.infer<typeof AppIsAuthorizedOnlySchema>);
		token: string;
	}> {
		const session =
			await this.prismaService.client.authSession.findUniqueOrThrow({
				where: { id: src.id },
				include: { app: { include: { accessTokens: true } } },
			});

		const data = {
			app: new EntityMap('id', [session.app]),
			access_token: new EntityMap('id', session.app.accessTokens),
		};

		if (me == null) {
			return {
				id: session.id,
				token: session.token,
				app: this.appEntityService.packLite(session.app.id, data),
			};
		} else {
			return {
				id: session.id,
				token: session.token,
				app: {
					...this.appEntityService.packLite(session.app.id, data),
					...this.appEntityService.packAuthorizedOnly(
						session.app.id,
						me.id,
						data,
					),
				},
			};
		}
	}
}
