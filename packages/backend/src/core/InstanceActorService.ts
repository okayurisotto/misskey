import { Injectable } from '@nestjs/common';
import type { LocalUser } from '@/models/entities/User.js';
import { MemorySingleCache } from '@/misc/MemorySingleCache.js';
import { CreateSystemUserService } from '@/core/CreateSystemUserService.js';
import { PrismaService } from '@/core/PrismaService.js';

const ACTOR_USERNAME = 'instance.actor' as const;

@Injectable()
export class InstanceActorService {
	private readonly cache: MemorySingleCache<LocalUser>;

	constructor(
		private readonly createSystemUserService: CreateSystemUserService,
		private readonly prismaService: PrismaService,
	) {
		this.cache = new MemorySingleCache<LocalUser>(Infinity);
	}

	public async getInstanceActor(): Promise<LocalUser> {
		const cached = this.cache.get();
		if (cached) return cached;

		const user = (await this.prismaService.client.user.findFirst({
			where: {
				host: null,
				username: ACTOR_USERNAME,
			},
		})) as LocalUser | undefined;

		if (user) {
			this.cache.set(user);
			return user;
		} else {
			const created = (await this.createSystemUserService.createSystemUser(
				ACTOR_USERNAME,
			)) as LocalUser;
			this.cache.set(created);
			return created;
		}
	}
}
