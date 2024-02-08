import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MD5Schema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.boolean();
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'read:drive',
	description: 'Check if a given file exists.',
	res,
} as const;

export const paramDef = z.object({
	md5: MD5Schema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(private readonly prismaService: PrismaService) {
		super(meta, paramDef, async (ps, me) => {
			const exist =
				(await this.prismaService.client.driveFile.count({
					where: {
						md5: ps.md5,
						userId: me.id,
					},
					take: 1,
				})) > 0;

			return exist;
		});
	}
}
