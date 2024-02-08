import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import {
	noSuchFile___________,
	unexpectedFileType_,
	tooBigFile_,
	emptyFile__,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueueService } from '@/core/QueueService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { AlsoKnownAsValidationService } from '@/core/AlsoKnownAsValidationService.js';
import { ApiError } from '../../error.js';

export const meta = {
	secure: true,
	requireCredential: true,
	prohibitMoved: true,
	limit: {
		duration: ms('1hour'),
		max: 1,
	},
	errors: {
		noSuchFile: noSuchFile___________,
		unexpectedFileType: unexpectedFileType_,
		tooBigFile: tooBigFile_,
		emptyFile: emptyFile__,
	},
} as const;

export const paramDef = z.object({
	fileId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly queueService: QueueService,
		private readonly prismaService: PrismaService,
		private readonly alsoKnownAsValidationService: AlsoKnownAsValidationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const file = await this.prismaService.client.driveFile.findUnique({
				where: { id: ps.fileId },
			});

			if (file == null) throw new ApiError(meta.errors.noSuchFile);
			//if (!file.type.endsWith('/csv')) throw new ApiError(meta.errors.unexpectedFileType);
			if (file.size === 0) throw new ApiError(meta.errors.emptyFile);

			const checkMoving = await this.alsoKnownAsValidationService.validate(
				me,
				(old, src) =>
					!!src.movedAt &&
					src.movedAt.getTime() + 1000 * 60 * 60 * 2 > new Date().getTime(),
				true,
			);
			if (checkMoving ? file.size > 32 * 1024 * 1024 : file.size > 64 * 1024) {
				throw new ApiError(meta.errors.tooBigFile);
			}

			this.queueService.createImportFollowingJob(me, file.id);
		});
	}
}
