import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.object({
	password: z.string().length(8),
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
			const password = secureRndstr(8);
			const hash = bcrypt.hashSync(password);

			try {
				await this.prismaService.client.user_profile.update({
					where: {
						userId: ps.userId,
						user: { isRoot: false },
					},
					data: {
						password: hash,
					},
				});

				return { password };
			} catch (e) {
				if (e instanceof Prisma.PrismaClientKnownRequestError) {
					if (e.code === 'P2025') {
						throw new Error('Unable to locate the requested (non-root) user.');
					}
				}

				throw e;
			}
		});
	}
}
