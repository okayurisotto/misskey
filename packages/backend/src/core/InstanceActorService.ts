import { Injectable } from '@nestjs/common';
import type { LocalUser } from '@/models/entities/User.js';
import { CreateSystemUserService } from '@/core/CreateSystemUserService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { MemorySingleCacheF } from '@/misc/cache/MemorySingleCacheF.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';

const ACTOR_USERNAME = 'instance.actor' as const;

@Injectable()
export class InstanceActorService {
	private readonly cache;

	constructor(
		private readonly createSystemUserService: CreateSystemUserService,
		private readonly prismaService: PrismaService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {
		this.cache = new MemorySingleCacheF<LocalUser>(null, async () => {
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

				this.cache.set(created);
				return created;
			} else {
				if (!this.userEntityUtilService.isLocalUser(user)) {
					throw new Error();
				}

				this.cache.set(user);
				return user;
			}
		});
	}

	public async getInstanceActor(): Promise<LocalUser> {
		return await this.cache.fetch();
	}
}
