import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { IsNull } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { DriveFilesRepository } from '@/models/index.js';
import { DriveService } from '@/core/DriveService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

const paramDef_ = z.unknown();
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private driveService: DriveService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const files = await this.driveFilesRepository.findBy({
				userId: IsNull(),
			});

			for (const file of files) {
				this.driveService.deleteFile(file);
			}
		});
	}
}
