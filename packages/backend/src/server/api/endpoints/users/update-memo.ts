import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noSuchUser___________________________ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['account'],
	requireCredential: true,
	kind: 'write:account',
	errors: {noSuchUser:noSuchUser___________________________},
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
			const target = await this.prismaService.client.user.findUnique({
				where: { id: ps.userId },
			});
			if (target === null) {
				throw new ApiError(meta.errors.noSuchUser);
			}

			// 引数が空文字列かnullであればメモを削除する
			if (ps.memo === '' || ps.memo == null) {
				await this.prismaService.client.user_memo
					.delete({
						where: {
							userId_targetUserId: {
								userId: me.id,
								targetUserId: target.id,
							},
						},
					})
					.catch(() => {}); // 削除対象のメモが存在しなかった場合
				return;
			}

			await this.prismaService.client.user_memo.upsert({
				where: {
					userId_targetUserId: {
						userId: me.id,
						targetUserId: target.id,
					},
				},
				create: {
					id: this.idService.genId(),
					userId: me.id,
					targetUserId: target.id,
					memo: ps.memo,
				},
				update: {
					memo: ps.memo,
				},
			});
		});
	}
}
