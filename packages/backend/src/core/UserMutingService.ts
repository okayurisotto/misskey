import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { CacheService } from '@/core/CacheService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { UserMuting, user } from '@prisma/client';

@Injectable()
export class UserMutingService {
	constructor(
		private readonly idService: IdService,
		private readonly cacheService: CacheService,
		private readonly prismaService: PrismaService,
	) {}

	public async mute(
		user: user,
		target: user,
		expiresAt: Date | null = null,
	): Promise<void> {
		await this.prismaService.client.userMuting.create({
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

	public async unmute(mutings: UserMuting[]): Promise<void> {
		if (mutings.length === 0) return;

		await this.prismaService.client.userMuting.deleteMany({
			where: {
				id: { in: mutings.map((m) => m.id) },
			},
		});

		const muterIds = [...new Set(mutings.map((m) => m.muterId))];
		for (const muterId of muterIds) {
			this.cacheService.userMutingsCache.refresh(muterId);
		}
	}
}
