import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.object({
	password: z.string().min(8).max(8),
});
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps) => {
			const user = await this.prismaService.client.user.findUnique({
				where: { id: ps.userId },
			});

			if (user == null) {
				throw new Error('user not found');
			}

			if (user.isRoot) {
				throw new Error('cannot reset password of root');
			}

			const password = secureRndstr(8);
			const hash = bcrypt.hashSync(password);
			await this.prismaService.client.user_profile.update({
				where: { userId: user.id },
				data: { password: hash },
			});

			return { password } satisfies z.infer<typeof res>;
		});
	}
}
