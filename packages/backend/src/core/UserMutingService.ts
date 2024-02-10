import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { UserMuting, user } from '@prisma/client';

@Injectable()
export class UserMutingService {
	constructor(
		private readonly idService: IdService,
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
	}

	public async unmute(mutings: UserMuting[]): Promise<void> {
		if (mutings.length === 0) return;

		await this.prismaService.client.userMuting.deleteMany({
			where: {
				id: { in: mutings.map((m) => m.id) },
			},
		});
	}
}
