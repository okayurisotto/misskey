import { Injectable } from '@nestjs/common';
import type { LocalUser } from '@/models/entities/User.js';
import { CreateSystemUserService } from '@/core/CreateSystemUserService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';

const ACTOR_USERNAME = 'instance.actor' as const;

@Injectable()
export class InstanceActorService {
	constructor(
		private readonly createSystemUserService: CreateSystemUserService,
		private readonly prismaService: PrismaService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	public async getInstanceActor(): Promise<LocalUser> {
		const user = await this.prismaService.client.user.findFirst({
			where: {
				host: null,
				username: ACTOR_USERNAME,
			},
		});

		if (user === null) {
			const created =
				await this.createSystemUserService.createSystemUser(ACTOR_USERNAME);

			if (!this.userEntityUtilService.isLocalUser(created)) {
				throw new Error();
			}

			return created;
		} else {
			if (!this.userEntityUtilService.isLocalUser(user)) {
				throw new Error();
			}

			return user;
		}
	}
}
