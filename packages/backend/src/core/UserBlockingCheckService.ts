import { Injectable } from '@nestjs/common';
import { PrismaService } from './PrismaService.js';

@Injectable()
export class UserBlockingCheckService {
	constructor(private readonly prismaService: PrismaService) {}

	public async check(blockerId: string, blockeeId: string): Promise<boolean> {
		const blocking = await this.prismaService.client.blocking.findUnique({
			where: { blockerId_blockeeId: { blockerId, blockeeId } },
		});

		return blocking !== null;
	}
}
