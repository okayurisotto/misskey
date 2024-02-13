import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import type { Note, User } from '@prisma/client';

@Injectable()
export class NoteVisibilityService {
	constructor(private readonly prismaService: PrismaService) {}

	/**
	 * その`note`が`meId`で指定された閲覧者にとって閲覧可能か判定する。
	 *
	 * @param note
	 * @param meId
	 * @returns
	 */
	public async isVisibleForMe(
		note: Note,
		meId: User['id'] | null,
	): Promise<boolean> {
		// This code must always be synchronized with the checks in generateVisibilityQuery.
		// `visibility`が`'specified'` && 自分が指定されていない => 非表示
		if (note.visibility === 'specified') {
			if (meId == null) {
				return false;
			} else if (meId === note.userId) {
				return true;
			} else {
				// 指定されているかどうか
				return note.visibleUserIds.some((id) => meId === id);
			}
		}

		// `visibility`が`'followers'` && 自分が投稿者のフォロワーでない => 非表示
		if (note.visibility === 'followers') {
			if (meId == null) {
				return false;
			} else if (meId === note.userId) {
				return true;
			} else if (meId === note.replyUserId) {
				// 自分の投稿に対するリプライだった場合は表示する
				return true;
			} else if (note.mentions.some((id) => meId === id)) {
				// 自分へのメンションが含まれる場合は表示する
				return true;
			} else {
				// 自分が投稿者のフォロワーかどうか
				const [following, user] = await Promise.all([
					this.prismaService.client.following.count({
						where: {
							followeeId: note.userId,
							followerId: meId,
						},
						take: 1,
					}),
					this.prismaService.client.user.findUniqueOrThrow({
						where: { id: meId },
					}),
				]);

				if (following > 0) {
					return true;
				} else {
					// `note`がリモートのもので、なおかつ`meId`によって指定される閲覧者もまたリモートのユーザーだった場合、visibleであると判定する
					// 閲覧者がリモートユーザーであることはほぼないと思われるが十分な確認はできていない。
					return note.userHost !== null && user.host !== null;
				}
			}
		}

		return true;
	}
}
