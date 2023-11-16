import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DriveService } from '@/core/DriveService.js';
import { PrismaService } from '@/core/PrismaService.js';

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
		private readonly driveService: DriveService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async () => {
			const files = await this.prismaService.client.drive_file.findMany({
				where: { userId: null },
			});

			await Promise.all(
				files.map((file) => this.driveService.deleteFile(file)),
			);
		});
	}
}
