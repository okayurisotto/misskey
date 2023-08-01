import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { DriveFilesRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { md5Pattern } from '@/models/zod/misc.js';

const res = z.boolean();
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'read:drive',
	description: 'Check if a given file exists.',
	res,
} as const;

export const paramDef = z.object({
	md5: md5Pattern,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const exist = await this.driveFilesRepository.exist({
				where: {
					md5: ps.md5,
					userId: me.id,
				},
			});

			return exist satisfies z.infer<typeof res>;
		});
	}
}
