import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DeleteAccountService } from '@/core/DeleteAccountService.js';
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
		private readonly deleteAccountService: DeleteAccountService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const profile =
				await this.prismaService.client.user_profile.findUniqueOrThrow({
					where: { userId: me.id },
				});
			const userDetailed =
				await this.prismaService.client.user.findUniqueOrThrow({
					where: { id: me.id },
				});
			if (userDetailed.isDeleted) {
				return;
			}

			// Compare password
			const same = await bcrypt.compare(ps.password, profile.password!);

			if (!same) {
				throw new Error('incorrect password');
			}

			await this.deleteAccountService.deleteAccount(me);
		});
	}
}
