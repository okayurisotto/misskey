import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import type { user } from '@prisma/client';

@Injectable()
export class DriveUsageCalcService {
	constructor(private readonly prismaService: PrismaService) {}

	/**
	 * 指定されたユーザーによるファイルの合計サイズを計算する。
	 *
	 * @param user
	 * @returns
	 */
	public async calcUser(
		user: user['id'] | { id: user['id'] },
	): Promise<number> {
		const id = typeof user === 'object' ? user.id : user;

		const {
			_sum: { size },
		} = await this.prismaService.client.driveFile.aggregate({
			where: { userId: id, isLink: false },
			_sum: { size: true },
		});

		return size ?? 0;
	}
}
