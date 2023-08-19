import { tooManyClips } from '@/server/api/errors.js';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { ClipEntityService } from '@/core/entities/ClipEntityService.js';
import { RoleService } from '@/core/RoleService.js';
import { ApiError } from '@/server/api/error.js';
import { ClipSchema } from '@/models/zod/ClipSchema.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = ClipSchema;
export const meta = {
	tags: ['clips'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	res,
	errors: {tooManyClips:tooManyClips},
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
		private readonly clipEntityService: ClipEntityService,
		private readonly roleService: RoleService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const currentCount = await this.prismaService.client.clip.count({
				where: { userId: me.id },
			});
			if (
				currentCount > (await this.roleService.getUserPolicies(me.id)).clipLimit
			) {
				throw new ApiError(meta.errors.tooManyClips);
			}

			const clip = await this.prismaService.client.clip.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					userId: me.id,
					name: ps.name,
					isPublic: ps.isPublic,
					description: ps.description,
				},
			});

			return (await this.clipEntityService.pack(clip, me)) satisfies z.infer<
				typeof res
			>;
		});
	}
}
