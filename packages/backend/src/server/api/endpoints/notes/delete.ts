import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import z from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import type { UsersRepository } from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { NoteDeleteService } from '@/core/NoteDeleteService.js';
import { DI } from '@/di-symbols.js';
import { GetterService } from '@/server/api/GetterService.js';
import { RoleService } from '@/core/RoleService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';
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
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '490be23f-8c1f-4796-819f-94cb4f9d1630',
		},
		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: 'fe8d7103-0ea8-4ec3-814d-f8b401dc69e9',
		},
	},
} as const;

const paramDef_ = z.object({ noteId: misskeyIdPattern });
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private getterService: GetterService,
		private roleService: RoleService,
		private noteDeleteService: NoteDeleteService,
	) {
		super(meta, paramDef_, async (ps, me) => {
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
				await this.usersRepository.findOneByOrFail({ id: note.userId }),
				note,
			)) satisfies z.infer<typeof res>;
		});
	}
}
