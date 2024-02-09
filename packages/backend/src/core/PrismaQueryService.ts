import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '@/core/PrismaService.js';
import type { Prisma, user } from '@prisma/client';

export type PaginationQuery = {
	where: {
		AND: (
			| Record<never, never>
			| { id: Partial<Record<'gt' | 'lt', string | undefined>> }
			| { createdAt: Partial<Record<'gt' | 'lt', Date | undefined>> }
		)[];
	};
	orderBy: { id: 'asc' | 'desc' } | { createdAt: 'asc' | 'desc' };
	skip: number | undefined;
	take: number | undefined;
};

@Injectable()
export class PrismaQueryService {
	constructor(private readonly prismaService: PrismaService) {}

	public getPaginationQuery(opts: {
		sinceId?: string;
		untilId?: string;
		sinceDate?: number;
		untilDate?: number;
		offset?: number;
		take?: number;
	}): PaginationQuery {
		const orderBy = (():
			| { id: 'asc' | 'desc' }
			| { createdAt: 'asc' | 'desc' } => {
			if (opts.sinceId && opts.untilId) return { id: 'desc' };
			if (opts.sinceId) return { id: 'asc' };
			if (opts.untilId) return { id: 'desc' };

			if (opts.sinceDate && opts.untilDate) return { createdAt: 'desc' };
			if (opts.sinceDate) return { createdAt: 'asc' };
			if (opts.untilDate) return { createdAt: 'desc' };

			return { id: 'desc' };
		})();

		return {
			where: {
				AND: [
					{ id: { gt: opts.sinceId } },
					{ id: { lt: opts.untilId } },
					opts.sinceDate ? { createdAt: { gt: new Date(opts.sinceDate) } } : {},
					opts.untilDate ? { createdAt: { lt: new Date(opts.untilDate) } } : {},
				],
			},
			orderBy,
			take: opts.take,
			skip: opts.offset,
		};
	}

	public getVisibilityWhereForNote(
		userId: user['id'] | null,
	): Prisma.NoteWhereInput {
		if (userId === null) {
			return { OR: [{ visibility: 'public' }, { visibility: 'home' }] };
		}

		return {
			AND: [
				{
					OR: [
						{ visibility: 'public' },
						{ visibility: 'home' },
						{ userId },
						{ visibleUserIds: { has: userId } },
						{ mentions: { has: userId } },
						{
							visibility: 'followers',
							OR: [
								{
									user: {
										following_following_followeeIdTouser: {
											some: { followerId: userId },
										},
									},
								},
								{ replyUserId: userId },
							],
						},
					],
				},
			],
		};
	}

	public getRepliesWhereForNote(
		userId: user['id'] | null,
	): Prisma.NoteWhereInput {
		if (userId === null) {
			return {
				OR: [
					{ replyId: null },
					{
						AND: [
							{ replyId: { not: null } },
							{
								replyUserId: {
									equals: this.prismaService.client.note.fields.userId,
								},
							},
						],
					},
				],
			};
		} else {
			return {
				OR: [
					{ replyId: null },
					{ replyUserId: userId },
					{ replyId: { not: null }, userId },
					{
						replyId: { not: null },
						replyUserId: {
							equals: this.prismaService.client.note.fields.userId,
						},
					},
				],
			};
		}
	}

	public getChannelWhereForNote(
		userId: user['id'] | null,
	): Prisma.NoteWhereInput {
		if (userId === null) return { channelId: null };

		return {
			OR: [
				{ channelId: null },
				{ channel: { followings: { some: { userId } } } },
			],
		};
	}

	public getBlockedWhereForNote(
		userId: user['id'] | null,
	): Prisma.NoteWhereInput {
		if (userId === null) return {};

		return {
			AND: [
				{
					user: {
						blocking_blocking_blockerIdTouser: { none: { blockeeId: userId } },
					},
				},
				{
					OR: [
						{ replyUserId: null },
						{
							reply: {
								user: {
									blocking_blocking_blockerIdTouser: {
										none: { blockeeId: userId },
									},
								},
							},
						},
					],
				},
				{
					OR: [
						{ renoteUserId: null },
						{
							renote: {
								user: {
									blocking_blocking_blockerIdTouser: {
										none: { blockeeId: userId },
									},
								},
							},
						},
					],
				},
			],
		};
	}

	public async getNoteThreadMutingWhereForNote(
		userId: user['id'] | null,
	): Promise<Prisma.NoteWhereInput> {
		if (userId === null) return {};

		const mutedThreads =
			await this.prismaService.client.note_thread_muting.findMany({
				where: { userId },
				select: { threadId: true },
			});

		return {
			threadId: { notIn: mutedThreads.map(({ threadId }) => threadId) },
		};
	}

	public async getMutingWhereForNote(
		userId: user['id'] | null,
	): Promise<Prisma.NoteWhereInput> {
		if (userId === null) return {};

		const meProfile =
			await this.prismaService.client.user_profile.findUniqueOrThrow({
				where: { userId },
			});
		const mutedInstances = z.array(z.string()).parse(meProfile.mutedInstances);

		return {
			AND: [
				// user
				{
					user: { muting_muting_muteeIdTouser: { none: { muterId: userId } } },
				},
				{
					OR: [
						{ replyUserId: null },
						{
							reply: {
								user: {
									muting_muting_muteeIdTouser: { none: { muterId: userId } },
								},
							},
						},
					],
				},
				{
					OR: [
						{ renoteId: null },
						{
							renote: {
								user: {
									muting_muting_muteeIdTouser: { none: { muterId: userId } },
								},
							},
						},
					],
				},
				// instance
				{
					OR: [{ userHost: null }, { userHost: { notIn: mutedInstances } }],
				},
				{
					OR: [
						{ replyUserHost: null },
						{ replyUserHost: { notIn: mutedInstances } },
					],
				},
				{
					OR: [
						{ renoteUserHost: null },
						{ renoteUserHost: { notIn: mutedInstances } },
					],
				},
			],
		};
	}

	public async getRenoteMutingWhereForNote(
		userId: user['id'] | null,
	): Promise<Prisma.NoteWhereInput> {
		if (userId === null) return {};

		const renoteMutings =
			await this.prismaService.client.renote_muting.findMany({
				where: { muterId: userId },
			});

		return {
			OR: [
				{
					renoteId: { not: null },
					text: null,
					userId: { notIn: renoteMutings.map(({ muteeId }) => muteeId) },
				},
				{ renoteId: null },
				{ text: { not: null } },
			],
		};
	}

	public getBlockedWhereForUser(
		userId: user['id'] | null,
	): Prisma.userWhereInput {
		if (userId === null) return {};

		return {
			blocking_blocking_blockeeIdTouser: { none: { blockerId: userId } },
			blocking_blocking_blockerIdTouser: { none: { blockeeId: userId } },
		};
	}

	public getMutingWhereForUser(
		userId: user['id'] | null,
	): Prisma.userWhereInput {
		if (userId === null) return {};
		return { muting_muting_muteeIdTouser: { none: { muterId: userId } } };
	}

	public getVisibilityWhereForNoteReaction(
		userId: user['id'] | null,
	): Prisma.note_reactionWhereInput {
		if (userId === null) {
			return {
				OR: [
					{ note: { visibility: 'public' } },
					{ note: { visibility: 'home' } },
				],
			};
		}

		return {
			AND: [
				{
					OR: [
						{ note: { visibility: 'public' } },
						{ note: { visibility: 'home' } },
						{ note: { userId } },
						{ note: { visibleUserIds: { has: userId } } },
						{ note: { mentions: { has: userId } } },
						{
							note: {
								visibility: 'followers',
								OR: [
									{
										user: {
											following_following_followeeIdTouser: {
												some: { followerId: userId },
											},
										},
									},
									{ replyUserId: userId },
								],
							},
						},
					],
				},
			],
		};
	}
}
