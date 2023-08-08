import { Injectable } from '@nestjs/common';
import type { Muting } from '@/models/index.js';
import { IdService } from '@/core/IdService.js';
import type { User } from '@/models/entities/User.js';
import { bindThis } from '@/decorators.js';
import { CacheService } from '@/core/CacheService.js';
import type { T2P } from '@/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { muting, user } from '@prisma/client';

@Injectable()
export class UserMutingService {
	constructor(
		private readonly idService: IdService,
		private readonly cacheService: CacheService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async mute(user: T2P<User, user>, target: T2P<User, user>, expiresAt: Date | null = null): Promise<void> {
		await this.prismaService.client.muting.create({
			data: {
				id: this.idService.genId(),
				createdAt: new Date(),
				expiresAt: expiresAt ?? null,
				muterId: user.id,
				muteeId: target.id,
			},
		});

		this.cacheService.userMutingsCache.refresh(user.id);
	}

	@bindThis
	public async unmute(mutings: T2P<Muting, muting>[]): Promise<void> {
		if (mutings.length === 0) return;

		await this.prismaService.client.muting.deleteMany({
			where: {
				id: { in: mutings.map(m => m.id) },
			}
		});

		const muterIds = [...new Set(mutings.map(m => m.muterId))];
		for (const muterId of muterIds) {
			this.cacheService.userMutingsCache.refresh(muterId);
		}
	}
}
