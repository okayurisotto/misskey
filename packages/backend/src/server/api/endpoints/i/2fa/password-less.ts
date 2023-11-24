import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { noKey } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../../error.js';

export const meta = {
	requireCredential: true,
	secure: true,
	errors: { noKey: noKey },
} as const;

export const paramDef = z.object({
	value: z.boolean(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (ps.value) {
				// セキュリティキーがなければパスワードレスを有効にはできない
				const keyCount =
					await this.prismaService.client.user_security_key.count({
						where: { userId: me.id },
					});

				if (keyCount === 0) {
					await this.prismaService.client.user_profile.update({
						where: { userId: me.id },
						data: { usePasswordLessLogin: false },
					});

					throw new ApiError(meta.errors.noKey);
				}
			}

			await this.prismaService.client.user_profile.update({
				where: { userId: me.id },
				data: { usePasswordLessLogin: ps.value },
			});

			// Publish meUpdated event
			this.globalEventService.publishMainStream(
				me.id,
				'meUpdated',
				await this.userEntityService.packDetailedMe(me.id, {
					includeSecrets: true,
				}),
			);
		});
	}
}
