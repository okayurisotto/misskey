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

export const paramDef = z.object({
	host: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private driveService: DriveService,
		private prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps) => {
			const files = await this.prismaService.client.drive_file.findMany({
				where: { userHost: ps.host },
			});

			for (const file of files) {
				await this.driveService.deleteFile(file);
			}
		});
	}
}
