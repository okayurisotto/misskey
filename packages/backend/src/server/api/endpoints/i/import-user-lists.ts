import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueueService } from '@/core/QueueService.js';
import { AccountMoveService } from '@/core/AccountMoveService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
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
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'ea9cc34f-c415-4bc6-a6fe-28ac40357049',
		},
		unexpectedFileType: {
			message: 'We need csv file.',
			code: 'UNEXPECTED_FILE_TYPE',
			id: 'a3c9edda-dd9b-4596-be6a-150ef813745c',
		},
		tooBigFile: {
			message: 'That file is too big.',
			code: 'TOO_BIG_FILE',
			id: 'ae6e7a22-971b-4b52-b2be-fc0b9b121fe9',
		},
		emptyFile: {
			message: 'That file is empty.',
			code: 'EMPTY_FILE',
			id: '99efe367-ce6e-4d44-93f8-5fae7b040356',
		},
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
		private readonly accountMoveService: AccountMoveService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const file = await this.prismaService.client.drive_file.findUnique({
				where: { id: ps.fileId },
			});

			if (file == null) throw new ApiError(meta.errors.noSuchFile);
			//if (!file.type.endsWith('/csv')) throw new ApiError(meta.errors.unexpectedFileType);
			if (file.size === 0) throw new ApiError(meta.errors.emptyFile);

			const checkMoving = await this.accountMoveService.validateAlsoKnownAs(
				me,
				(old, src) =>
					!!src.movedAt &&
					src.movedAt.getTime() + 1000 * 60 * 60 * 2 > new Date().getTime(),
				true,
			);
			if (checkMoving ? file.size > 32 * 1024 * 1024 : file.size > 64 * 1024) {
				throw new ApiError(meta.errors.tooBigFile);
			}

			this.queueService.createImportUserListsJob(me, file.id);
		});
	}
}
