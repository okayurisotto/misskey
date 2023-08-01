import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import type { ClipsRepository } from '@/models/index.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { ApiError } from '@/server/api/error.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';

const res = ClipSchema;
export const meta = {
	tags: ['clips'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	res,
	errors: {
		tooManyClips: {
			message: 'You cannot create clip any more.',
			code: 'TOO_MANY_CLIPS',
			id: '920f7c2d-6208-4b76-8082-e632020f5883',
		},
	},
} as const;

export const paramDef = z.object({
	name: z.string().min(1).max(100),
	isPublic: z.boolean().default(false),
	description: z.string().min(1).max(2048).nullable().optional(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,

		private clipEntityService: ClipEntityService,
		private roleService: RoleService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const currentCount = await this.clipsRepository.countBy({
				userId: me.id,
			});
			if (
				currentCount > (await this.roleService.getUserPolicies(me.id)).clipLimit
			) {
				throw new ApiError(meta.errors.tooManyClips);
			}

			const clip = await this.clipsRepository
				.insert({
					id: this.idService.genId(),
					createdAt: new Date(),
					userId: me.id,
					name: ps.name,
					isPublic: ps.isPublic,
					description: ps.description,
				})
				.then((x) => this.clipsRepository.findOneByOrFail(x.identifiers[0]));

			return (await this.clipEntityService.pack(clip, me)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
