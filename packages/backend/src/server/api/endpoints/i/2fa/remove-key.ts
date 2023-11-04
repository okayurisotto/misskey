import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.object({});
export const meta = {
	requireCredential: true,
	secure: true,
	res,
} as const;

export const paramDef = z.object({
	password: z.string(),
	credentialId: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const profile =
				await this.prismaService.client.user_profile.findUniqueOrThrow({
					where: { userId: me.id },
				});

			// Compare password
			const same = await bcrypt.compare(ps.password, profile.password!);

			if (!same) {
				throw new Error('incorrect password');
			}

			// Make sure we only delete the user's own creds
			await this.prismaService.client.user_security_key.delete({
				where: {
					userId: me.id,
					id: ps.credentialId,
				},
			});

			// 使われているキーがなくなったらパスワードレスログインをやめる
			const keyCount = await this.prismaService.client.user_security_key.count({
				where: { userId: me.id },
			});

			if (keyCount === 0) {
				await this.prismaService.client.user_profile.update({
					where: { userId: me.id },
					data: { usePasswordLessLogin: false },
				});
			}

			// Publish meUpdated event
			this.globalEventService.publishMainStream(
				me.id,
				'meUpdated',
				await this.userEntityService.packDetailedMe(me.id, { includeSecrets: true }),
			);

			return {} satisfies z.infer<typeof res>;
		});
	}
}
