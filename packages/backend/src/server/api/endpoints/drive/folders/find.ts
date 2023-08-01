import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { DriveFoldersRepository } from '@/models/index.js';
import { DriveFolderEntityService } from '@/core/entities/DriveFolderEntityService.js';
import { DI } from '@/di-symbols.js';
import { DriveFolderSchema } from '@/models/zod/DriveFolderSchema.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

const res = z.array(DriveFolderSchema);
export const meta = {
	tags: ['drive'],
	requireCredential: true,
	kind: 'read:drive',
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({
	name: z.string(),
	parentId: misskeyIdPattern.nullable().default(null),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.driveFoldersRepository)
		private driveFoldersRepository: DriveFoldersRepository,

		private driveFolderEntityService: DriveFolderEntityService,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const folders = await this.driveFoldersRepository.findBy({
				name: ps.name,
				userId: me.id,
				parentId: ps.parentId ?? IsNull(),
			});

			return (await Promise.all(
				folders.map((folder) => this.driveFolderEntityService.pack(folder)),
			)) satisfies z.infer<typeof res>;
		});
	}
}
