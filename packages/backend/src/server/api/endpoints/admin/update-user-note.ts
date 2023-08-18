import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
	text: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps) => {
			try {
				await this.prismaService.client.user_profile.update({
					where: { userId: ps.userId },
					data: { moderationNote: ps.text },
				});
			} catch (e) {
				if (e instanceof Prisma.PrismaClientKnownRequestError) {
					if (e.code === 'P2025') {
						throw new Error('Unable to locate the requested user.');
					}
				}

				throw e;
			}
		});
	}
}
