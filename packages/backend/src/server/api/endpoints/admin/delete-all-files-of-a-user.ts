import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { DriveFileDeleteService } from '@/core/DriveFileDeleteService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireAdmin: true,
} as const;

export const paramDef = z.object({ userId: MisskeyIdSchema });

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly driveFileDeleteService: DriveFileDeleteService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const files = await this.prismaService.client.driveFile.findMany({
				where: { userId: ps.userId },
			});

			await Promise.all(
				files.map((file) => this.driveFileDeleteService.delete(file)),
			);
		});
	}
}
