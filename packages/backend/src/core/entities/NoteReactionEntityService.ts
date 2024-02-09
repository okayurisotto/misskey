import { Injectable } from '@nestjs/common';
import type { NoteReactionSchema } from '@/models/zod/NoteReactionSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { LegacyReactionConvertService } from '../LegacyReactionConvertService.js';
import { UserEntityPackLiteService } from './UserEntityPackLiteService.js';
import { NoteEntityPackService } from './NoteEntityPackService.js';
import type { z } from 'zod';
import type { NoteReaction, user } from '@prisma/client';

@Injectable()
export class NoteReactionEntityService {
	constructor(
		private readonly legacyReactionConvertService: LegacyReactionConvertService,
		private readonly noteEntityService: NoteEntityPackService,
		private readonly prismaService: PrismaService,
		private readonly userEntityPackLiteService: UserEntityPackLiteService,
	) {}

	/**
	 * `note_reaction`をpackする。
	 *
	 * @param src
	 * @param me
	 * @param options.withNote `true`だった場合、返り値に`note`が含まれるようになる
	 * @returns
	 */
	public async pack(
		src: NoteReaction['id'] | NoteReaction,
		me?: { id: user['id'] } | null | undefined,
		options?: {
			withNote: boolean;
		},
	): Promise<z.infer<typeof NoteReactionSchema>> {
		const opts = {
			withNote: false,
			...options,
		};

		const reaction =
			await this.prismaService.client.noteReaction.findUniqueOrThrow({
				where: { id: typeof src === 'string' ? src : src.id },
				include: { user: true },
			});

		return {
			id: reaction.id,
			createdAt: reaction.createdAt.toISOString(),
			user: await this.userEntityPackLiteService.packLite(reaction.user),
			type: this.legacyReactionConvertService.convert(reaction.reaction),
			...(opts.withNote
				? {
						note: await this.noteEntityService.pack(reaction.noteId, me),
				  }
				: {}),
		};
	}
}
