import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import {
	noSuchFile_________,
	noSuchUser__________,
	emptyFile,
	tooManyAntennas_,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueueService } from '@/core/QueueService.js';
import type { Antenna as _Antenna } from '@/models/index.js';
import { RoleService } from '@/core/RoleService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ExportedAntennaSchema } from '@/models/zod/ExportedAntennaSchema.js';
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
		noSuchFile: noSuchFile_________,
		noSuchUser: noSuchUser__________,
		emptyFile: emptyFile,
		tooManyAntennas: tooManyAntennas_,
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
		private readonly roleService: RoleService,
		private readonly queueService: QueueService,
		private readonly downloadService: DownloadService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const userExist =
				(await this.prismaService.client.user.count({
					where: { id: me.id },
					take: 1,
				})) > 0;
			if (!userExist) throw new ApiError(meta.errors.noSuchUser);

			const file = await this.prismaService.client.driveFile.findUnique({
				where: { id: ps.fileId },
			});
			if (file === null) throw new ApiError(meta.errors.noSuchFile);
			if (file.size === 0) throw new ApiError(meta.errors.emptyFile);

			const antennas = z
				.array(ExportedAntennaSchema)
				.parse(
					JSON.parse(await this.downloadService.downloadTextFile(file.url)),
				);

			const currentAntennasCount =
				await this.prismaService.client.antenna.count({
					where: { userId: me.id },
				});

			if (
				currentAntennasCount + antennas.length >
				(await this.roleService.getUserPolicies(me.id)).antennaLimit
			) {
				throw new ApiError(meta.errors.tooManyAntennas);
			}

			this.queueService.createImportAntennasJob(me, antennas);
		});
	}
}

export type Antenna = (_Antenna & { userListAccts: string[] | null })[];
