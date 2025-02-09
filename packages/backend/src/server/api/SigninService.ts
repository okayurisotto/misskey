import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import type { LocalUser } from '@/models/entities/User.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { SigninEntityService } from '@/core/entities/SigninEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class SigninService {
	constructor(
		private readonly signinEntityService: SigninEntityService,
		private readonly idService: IdService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {}

	public signin(request: FastifyRequest, reply: FastifyReply, user: LocalUser): { id: string; i: string | null } {
		setImmediate(async () => {
			// Append signin history
			const record = await this.prismaService.client.signin.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					userId: user.id,
					ip: request.ip,
					headers: request.headers as any,
					success: true,
				},
			});

			// Publish signin event
			this.globalEventService.publishMainStream(user.id, 'signin', this.signinEntityService.pack(record));
		});

		reply.code(200);
		return {
			id: user.id,
			i: user.token,
		};
	}
}
