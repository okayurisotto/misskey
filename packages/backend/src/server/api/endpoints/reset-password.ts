import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['reset password'],
	requireCredential: false,
	description: 'Complete the password reset that was previously requested.',
} as const;

export const paramDef = z.object({
	token: z.string(),
	password: z.string(),
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
			const req =
				await this.prismaService.client.passwordResetRequest.findUniqueOrThrow(
					{ where: { token: ps.token } },
				);

			// 発行してから30分以上経過していたら無効
			if (Date.now() - req.createdAt.getTime() > 1000 * 60 * 30) {
				throw new Error(); // TODO
			}

			// Generate hash of password
			const salt = await bcrypt.genSalt(8);
			const hash = await bcrypt.hash(ps.password, salt);

			await this.prismaService.client.user_profile.update({
				where: { userId: req.userId },
				data: { password: hash },
			});

			this.prismaService.client.passwordResetRequest.delete({
				where: { id: req.id },
			});
		});
	}
}
