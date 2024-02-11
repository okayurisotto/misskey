import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { range } from 'range';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { MetaService } from '@/core/MetaService.js';
import { PrismaService } from '@/core/PrismaService.js';

/*
 * トレンドに載るためには「『直近a分間のユニーク投稿数が今からa分前～今からb分前の間のユニーク投稿数のn倍以上』のハッシュタグの上位5位以内に入る」ことが必要
 * ユニーク投稿数とはそのハッシュタグと投稿ユーザーのペアのカウントで、例えば同じユーザーが複数回同じハッシュタグを投稿してもそのハッシュタグのユニーク投稿数は1とカウントされる
 *
 * ..が理想だけどPostgreSQLでどうするのか分からないので単に「直近Aの内に投稿されたユニーク投稿数が多いハッシュタグ」で妥協する
 */

const rangeA = 1000 * 60 * 60; // 60分
//const rangeB = 1000 * 60 * 120; // 2時間
//const coefficient = 1.25; // 「n倍」の部分
//const requiredUsers = 3; // 最低何人がそのタグを投稿している必要があるか

const max = 5;

const res = z.array(
	z.object({
		tag: z.string(),
		chart: z.array(z.number()),
		usersCount: z.number(),
	}),
);
export const meta = {
	tags: ['hashtags'],
	requireCredential: false,
	allowGet: true,
	cacheSec: 60 * 1,
	res,
} as const;

export const paramDef = z.object({});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async () => {
			const instance = await this.metaService.fetch();
			const hiddenTags = instance.hiddenTags.map((t) => normalizeForSearch(t));

			const now = new Date(); // 5分単位で丸めた現在日時
			now.setMinutes(Math.round(now.getMinutes() / 5) * 5, 0, 0);

			const tagNotes = await this.prismaService.client.note.findMany({
				where: {
					createdAt: { gt: new Date(now.getTime() - rangeA) },
					OR: [{ visibility: 'public' }, { visibility: 'home' }],
					tags: { isEmpty: false },
				},
			});

			if (tagNotes.length === 0) {
				return [];
			}

			const tags = [
				...tagNotes
					.map((note) => note.tags.map((tag) => ({ tag, userId: note.userId })))
					.flat()
					.filter((entry) => !hiddenTags.includes(entry.tag))
					.reduce<Map<string, string[]>>((acc, entry) => {
						const prevUserIds = acc.get(entry.tag) ?? [];
						const userIds = [...prevUserIds, entry.userId];
						return acc.set(entry.tag, userIds);
					}, new Map()),
			].map(([name, users]) => ({ name, users }));

			const hotTags = tags
				.sort((a, b) => b.users.length - a.users.length)
				.slice(0, max)
				.map((tag) => tag.name);

			//#region 2(または3)で話題と判定されたタグそれぞれについて過去の投稿数グラフを取得する
			const length = 20;
			const interval = 1000 * 60 * 10; // 10分

			const countsLog = await Promise.all(
				range({ stop: length }).map(async (i) => {
					return await Promise.all(
						hotTags.map(async (tag) => {
							const result = await this.prismaService.client.note.aggregate({
								_count: { userId: true },
								where: {
									tags: { has: tag },
									createdAt: {
										lt: new Date(now.getTime() - interval * (i + 0)),
										gt: new Date(now.getTime() - interval * (i + 1)),
									},
								},
							});

							return result._count.userId;
						}),
					);
				}),
			);
			//#endregion

			const totalCounts = await Promise.all(
				hotTags.map(async (tag) => {
					const result = await this.prismaService.client.note.aggregate({
						_count: { userId: true },
						where: {
							tags: { has: tag },
							createdAt: { gt: new Date(now.getTime() - rangeA) },
						},
					});

					return result._count.userId;
				}),
			);

			const stats = hotTags.map((tag, i) => ({
				tag,
				chart: countsLog.map((counts) => counts[i]),
				usersCount: totalCounts[i],
			}));

			return stats;
		});
	}
}
