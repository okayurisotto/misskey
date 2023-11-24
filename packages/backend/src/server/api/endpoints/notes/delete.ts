import ms from 'ms';
import { Injectable } from '@nestjs/common';
import z from 'zod';
import {
	noSuchNote_______,
	accessDenied__________,
} from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteDeleteService } from '@/core/NoteDeleteService.js';
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
	errors: {
		noSuchNote: noSuchNote_______,
		accessDenied: accessDenied__________,
	},
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
		private readonly noteDeleteService: NoteDeleteService,
		private readonly prismaService: PrismaService,
		private readonly roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const note = await this.prismaService.client.note.findUniqueOrThrow({
				where: { id: ps.noteId },
				include: { user: true },
			});

			// この操作を行うユーザーはノート作成者に限定されない。
			// モデレーターもまたこのAPIからノートを削除することがある。
			if (note.userId !== me.id) {
				const isModerator = await this.roleService.isModerator(me);
				if (!isModerator) {
					throw new ApiError(meta.errors.accessDenied);
				}
			}

			await this.noteDeleteService.delete(note.user, note);
		});
	}
}
