import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { PrismaService } from '@/core/PrismaService.js';
import { DriveFileDeleteService } from '@/core/DriveFileDeleteService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = z.object({});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly driveFileDeleteService: DriveFileDeleteService,
	) {
		super(meta, paramDef, async () => {
			const files = await this.prismaService.client.driveFile.findMany({
				where: { userId: null },
			});

			await Promise.all(
				files.map((file) => this.driveFileDeleteService.delete(file)),
			);
		});
	}
}
