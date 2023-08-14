import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { AntennaSchema } from '@/models/zod/AntennaSchema.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { antenna } from '@prisma/client';

@Injectable()
export class AntennaEntityService {
	constructor(private readonly prismaService: PrismaService) {}

	@bindThis
	public async pack(
		src: antenna['id'] | antenna,
	): Promise<z.infer<typeof AntennaSchema>> {
		const antenna = typeof src === 'object'
			? src
			: await this.prismaService.client.antenna.findUniqueOrThrow({ where: { id: src } });

		return {
			id: antenna.id,
			createdAt: antenna.createdAt.toISOString(),
			name: antenna.name,
			keywords: z.array(z.array(z.string())).parse(antenna.keywords),
			excludeKeywords: z.array(z.array(z.string())).parse(antenna.excludeKeywords),
			src: antenna.src,
			userListId: antenna.userListId,
			users: antenna.users,
			caseSensitive: antenna.caseSensitive,
			notify: antenna.notify,
			withReplies: antenna.withReplies,
			withFile: antenna.withFile,
			isActive: antenna.isActive,
			hasUnreadNote: false, // TODO
		};
	}
}
