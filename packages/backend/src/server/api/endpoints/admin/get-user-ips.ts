import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.array(z.object({ ip: z.string(), createdAt: z.string() }));
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z.object({ userId: MisskeyIdSchema });

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps) => {
			const ips = await this.prismaService.client.user_ip.findMany({
				where: { userId: ps.userId },
				orderBy: { createdAt: 'desc' },
				take: 30,
			});

			return ips.map((x) => ({
				ip: x.ip,
				createdAt: x.createdAt.toISOString(),
			})) satisfies z.infer<typeof res>;
		});
	}
}
