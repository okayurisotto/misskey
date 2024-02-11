import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import generateUserToken from '@/misc/generate-native-user-token.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	requireCredential: true,
	secure: true,
} as const;

export const paramDef = z.object({
	password: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const freshUser = await this.prismaService.client.user.findUniqueOrThrow({
				where: { id: me.id },
			});
			const oldToken = freshUser.token!;

			const profile =
				await this.prismaService.client.user_profile.findUniqueOrThrow({
					where: { userId: me.id },
				});

			// Compare password
			const same = await bcrypt.compare(ps.password, profile.password!);

			if (!same) throw new Error('incorrect password');

			const newToken = generateUserToken();

			await this.prismaService.client.user.update({
				where: { id: me.id },
				data: { token: newToken },
			});

			// Publish event
			this.globalEventService.publishMainStream(me.id, 'myTokenRegenerated');
		});
	}
}
