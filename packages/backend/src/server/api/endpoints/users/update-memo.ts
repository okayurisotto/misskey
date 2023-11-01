import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'write:account',
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
	memo: z
		.string()
		.nullable()
		.describe(
			'A personal memo for the target user. If null or empty, delete the memo.',
		),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (ps.memo === null || ps.memo.trim() === '') {
				// 引数がnullか空文字列であればメモを削除する
				await this.prismaService.client.user_memo
					.delete({
						where: {
							userId_targetUserId: {
								userId: me.id,
								targetUserId: ps.userId,
							},
						},
					})
					.catch(() => {}); // TODO: 握りつぶしたくない
			} else {
				await this.prismaService.client.user_memo.upsert({
					where: {
						userId_targetUserId: {
							userId: me.id,
							targetUserId: ps.userId,
						},
					},
					create: {
						id: this.idService.genId(),
						userId: me.id,
						targetUserId: ps.userId,
						memo: ps.memo,
					},
					update: {
						memo: ps.memo,
					},
				});
			}
		});
	}
}
