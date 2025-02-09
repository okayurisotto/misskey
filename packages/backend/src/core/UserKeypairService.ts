import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import type { user_keypair, User } from '@prisma/client';

@Injectable()
export class UserKeypairService {
	constructor(private readonly prismaService: PrismaService) {}

	public async getUserKeypair(userId: User['id']): Promise<user_keypair> {
		return await this.prismaService.client.user_keypair.findUniqueOrThrow({
			where: { userId },
		});
	}
}
