import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { tooManyClipNotes } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { IdService } from '@/core/IdService.js';
import { RoleService } from '@/core/RoleService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['account', 'notes', 'clips'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	limit: {
		duration: ms('1hour'),
		max: 20,
	},
	errors: { tooManyClipNotes: tooManyClipNotes },
} as const;

export const paramDef = z.object({
	clipId: MisskeyIdSchema,
	noteId: MisskeyIdSchema,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly idService: IdService,
		private readonly roleService: RoleService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const [currentCount, policies] = await Promise.all([
				this.prismaService.client.clipNote.count({
					where: { clipId: ps.clipId },
				}),
				this.roleService.getUserPolicies(me.id),
			]);

			if (currentCount > policies.noteEachClipsLimit) {
				throw new ApiError(meta.errors.tooManyClipNotes);
			}

			await this.prismaService.client.clipNote.create({
				data: {
					id: this.idService.genId(),
					noteId: ps.noteId,
					clipId: ps.clipId,
				},
			});

			await this.prismaService.client.clip.update({
				where: { id: ps.clipId },
				data: { lastClippedAt: new Date() },
			});
		});
	}
}
