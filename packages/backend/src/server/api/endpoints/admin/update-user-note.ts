import { z } from 'zod';
import { Injectable } from '@nestjs/common';
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
			const user = await this.prismaService.client.user.findUnique({
				where: { id: ps.userId },
			});

			if (user === null) {
				throw new Error('user not found');
			}

			await this.prismaService.client.user_profile.update({
				where: { userId: user.id },
				data: { moderationNote: ps.text },
			});
		});
	}
}
