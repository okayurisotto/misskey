import { Injectable } from '@nestjs/common';
import { MemorySingleCacheF } from '@/misc/cache/MemorySingleCacheF.js';
import { StreamMessages } from '@/server/api/stream/types.js';
import { RedisSubService } from '@/core/RedisSubService.js';
import { bindThis } from '@/decorators.js';
import { MemoryKVCacheF } from '@/misc/cache/MemoryKVCacheF.js';
import { PrismaService } from './PrismaService.js';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { role, role_assignment } from '@prisma/client';

@Injectable()
export class RoleCacheService implements OnApplicationShutdown {
	public readonly rolesCache = new MemorySingleCacheF<role[]>(
		1000 * 60 * 60 * 1,
		async () => await this.prismaService.client.role.findMany(),
	);
	public readonly roleAssignmentByUserIdCache = new MemoryKVCacheF<
		role_assignment[]
	>(1000 * 60 * 60 * 1, async (key) => {
		return await this.prismaService.client.role_assignment.findMany({
			where: { userId: key },
		});
	});

	constructor(
		private readonly redisForSub: RedisSubService,
		private readonly prismaService: PrismaService,
	) {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.redisForSub.on('message', this.onMessage);
	}

	@bindThis
	private async onMessage(_: string, data: string): Promise<void> {
		const obj = JSON.parse(data);

		if (obj.channel === 'internal') {
			const { type, body } =
				obj.message as StreamMessages['internal']['payload'];
			switch (type) {
				case 'roleCreated': {
					const cached = this.rolesCache.get();
					if (cached) {
						cached.push({
							...body,
							createdAt: new Date(body.createdAt),
							updatedAt: new Date(body.updatedAt),
							lastUsedAt: new Date(body.lastUsedAt),
						});
					}
					break;
				}
				case 'roleUpdated': {
					const cached = this.rolesCache.get();
					if (cached) {
						const i = cached.findIndex((x) => x.id === body.id);
						if (i > -1) {
							cached[i] = {
								...body,
								createdAt: new Date(body.createdAt),
								updatedAt: new Date(body.updatedAt),
								lastUsedAt: new Date(body.lastUsedAt),
							};
						}
					}
					break;
				}
				case 'roleDeleted': {
					const cached = this.rolesCache.get();
					if (cached) {
						this.rolesCache.set(cached.filter((x) => x.id !== body.id));
					}
					break;
				}
				case 'userRoleAssigned': {
					const cached = this.roleAssignmentByUserIdCache.get(body.userId);
					if (cached) {
						cached.push({
							...body,
							createdAt: new Date(body.createdAt),
							expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
						});
					}
					break;
				}
				case 'userRoleUnassigned': {
					const cached = this.roleAssignmentByUserIdCache.get(body.userId);
					if (cached) {
						this.roleAssignmentByUserIdCache.set(
							body.userId,
							cached.filter((x) => x.id !== body.id),
						);
					}
					break;
				}
				default:
					break;
			}
		}
	}

	public dispose(): void {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		this.redisForSub.off('message', this.onMessage);
		this.roleAssignmentByUserIdCache.dispose();
	}

	public onApplicationShutdown(): void {
		this.dispose();
	}
}
