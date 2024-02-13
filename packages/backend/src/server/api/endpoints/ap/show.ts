import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { noSuchObject } from '@/server/api/errors.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { LocalUser } from '@/models/entities/User.js';
import { isActor, isPost, getApId } from '@/core/activitypub/type.js';
import { ApResolverService } from '@/core/activitypub/ApResolverService.js';
import { MetaService } from '@/core/MetaService.js';
import { ApNoteService } from '@/core/activitypub/models/ApNoteService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { NoteEntityPackService } from '@/core/entities/NoteEntityPackService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { UserDetailedNotMeSchema } from '@/models/zod/UserDetailedNotMeSchema.js';
import { NoteSchema } from '@/models/zod/NoteSchema.js';
import { ApPersonCreateService } from '@/core/activitypub/models/ApPersonCreateService.js';
import { ApUserIdResolverService } from '@/core/activitypub/ApUserIdResolverService.js';
import { ApNoteIdResolverService } from '@/core/activitypub/ApNoteIdResolverService.js';
import { ApiError } from '../../error.js';
import type { Note, User } from '@prisma/client';

const res = z
	.union([
		z.object({ type: z.enum(['User']), object: UserDetailedNotMeSchema }),
		z.object({ type: z.enum(['Note']), object: NoteSchema }),
	])
	.nullable();
export const meta = {
	tags: ['federation'],
	requireCredential: true,
	limit: {
		duration: ms('1hour'),
		max: 30,
	},
	errors: { noSuchObject: noSuchObject },
	res,
} as const;

export const paramDef = z.object({
	uri: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
		private readonly apNoteIdResolverService: ApNoteIdResolverService,
		private readonly apNoteService: ApNoteService,
		private readonly apPersonCreateService: ApPersonCreateService,
		private readonly apResolverService: ApResolverService,
		private readonly apUserIdResolverService: ApUserIdResolverService,
		private readonly metaService: MetaService,
		private readonly noteEntityService: NoteEntityPackService,
		private readonly userEntityService: UserEntityService,
		private readonly utilityService: UtilityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const object = await this.fetchAny(ps.uri, me);
			if (object) {
				return object;
			} else {
				throw new ApiError(meta.errors.noSuchObject);
			}
		});
	}

	/***
	 * URIからUserかNoteを解決する
	 */
	private async fetchAny(
		uri: string,
		me: LocalUser | null | undefined,
	): Promise<z.infer<typeof res> | null> {
		// ブロックしてたら中断
		const fetchedMeta = await this.metaService.fetch();
		if (
			this.utilityService.isBlockedHost(
				fetchedMeta.blockedHosts,
				this.utilityService.extractDbHost(uri),
			)
		) {
			return null;
		}

		let local = await this.mergePack(
			me,
			...(await Promise.all([
				this.apUserIdResolverService.getUserFromApId(uri),
				this.apNoteIdResolverService.getNoteFromApId(uri),
			])),
		);
		if (local != null) return local;

		// リモートから一旦オブジェクトフェッチ
		const resolver = this.apResolverService.createResolver();
		const object = (await resolver.resolve(uri)) as any;

		// /@user のような正規id以外で取得できるURIが指定されていた場合、ここで初めて正規URIが確定する
		// これはDBに存在する可能性があるため再度DB検索
		if (uri !== object.id) {
			local = await this.mergePack(
				me,
				...(await Promise.all([
					this.apUserIdResolverService.getUserFromApId(object.id),
					this.apNoteIdResolverService.getNoteFromApId(object.id),
				])),
			);
			if (local != null) return local;
		}

		return await this.mergePack(
			me,
			isActor(object)
				? await this.apPersonCreateService.create(getApId(object))
				: null,
			isPost(object)
				? await this.apNoteService.createNote(getApId(object), undefined, true)
				: null,
		);
	}

	private async mergePack(
		me: LocalUser | null | undefined,
		user: User | null | undefined,
		note: Note | null | undefined,
	): Promise<z.infer<typeof res> | null> {
		if (user != null) {
			return {
				type: 'User',
				object: await this.userEntityService.packDetailed(user, me),
			};
		} else if (note != null) {
			try {
				const object = await this.noteEntityService.pack(note, me, {
					detail: true,
				});

				return {
					type: 'Note',
					object,
				};
			} catch (e) {
				return null;
			}
		}

		return null;
	}
}
