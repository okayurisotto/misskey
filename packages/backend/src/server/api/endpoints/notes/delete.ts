import ms from 'ms';
import { Injectable } from '@nestjs/common';
import z from 'zod';
import { noSuchNote_______, accessDenied__________ } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteDeleteService } from '@/core/NoteDeleteService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { RoleService } from '@/core/RoleService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ApiError } from '../../error.js';

const res = z.void();
export const meta = {
	tags: ['notes'],
	requireCredential: true,
	kind: 'write:notes',
	limit: {
		duration: ms('1hour'),
		max: 300,
		minInterval: ms('1sec'),
	},
	errors: {noSuchNote:noSuchNote_______,accessDenied:accessDenied__________},
} as const;

export const paramDef = z.object({ noteId: MisskeyIdSchema });

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly getterService: GetterService,
		private readonly roleService: RoleService,
		private readonly noteDeleteService: NoteDeleteService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.getterService.getNote(ps.noteId).catch((err) => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') {
					throw new ApiError(meta.errors.noSuchNote);
				}
				throw err;
			});

			if (!(await this.roleService.isModerator(me)) && note.userId !== me.id) {
				throw new ApiError(meta.errors.accessDenied);
			}

			// この操作を行うのが投稿者とは限らない(例えばモデレーター)ため
			(await this.noteDeleteService.delete(
				await this.prismaService.client.user.findUniqueOrThrow({
					where: { id: note.userId },
				}),
				note,
			)) satisfies z.infer<typeof res>;
		});
	}
}
