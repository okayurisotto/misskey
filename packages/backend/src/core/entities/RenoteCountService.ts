import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';

@Injectable()
export class RenoteCountService {
	constructor(private readonly prismaService: PrismaService) {}

	/**
	 * `userId`で指定したユーザーの、`renoteId`で指定した`note`の`renote`がいくつあるか数える。
	 *
	 * @param userId
	 * @param renoteId
	 * @param excludeNoteId カウントしない`renote`のID。
	 * @returns
	 */
	public async countSameRenotes(
		userId: string,
		renoteId: string,
		excludeNoteId: string | undefined,
	): Promise<number> {
		return await this.prismaService.client.note.count({
			where: {
				userId: userId,
				renoteId: renoteId,
				id: { not: excludeNoteId },
			},
		});
	}
}
