import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { bindThis } from '@/decorators.js';
import type { NoteReactionSchema } from '@/models/zod/NoteReactionSchema.js';
import type { User } from '@/models/entities/User.js';
import type { NoteReaction } from '@/models/entities/NoteReaction.js';
import type { T2P } from '@/types.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { OnModuleInit } from '@nestjs/common';
import type { ReactionService } from '../ReactionService.js';
import type { UserEntityService } from './UserEntityService.js';
import type { NoteEntityService } from './NoteEntityService.js';
import type { z } from 'zod';
import type { note_reaction } from '@prisma/client';

@Injectable()
export class NoteReactionEntityService implements OnModuleInit {
	private userEntityService: UserEntityService;
	private noteEntityService: NoteEntityService;
	private reactionService: ReactionService;

	constructor(
		private readonly moduleRef: ModuleRef,
		private readonly prismaService: PrismaService,
	) {}

	onModuleInit(): void {
		this.userEntityService = this.moduleRef.get('UserEntityService');
		this.noteEntityService = this.moduleRef.get('NoteEntityService');
		this.reactionService = this.moduleRef.get('ReactionService');
	}

	@bindThis
	public async pack(
		src: NoteReaction['id'] | T2P<NoteReaction, note_reaction>,
		me?: { id: User['id'] } | null | undefined,
		options?: {
			withNote: boolean;
		},
	): Promise<z.infer<typeof NoteReactionSchema>> {
		const opts = Object.assign({
			withNote: false,
		}, options);

		const reaction = typeof src === 'object'
			? src
			: await this.prismaService.client.note_reaction.findUniqueOrThrow({ where: { id: src } });

		return {
			id: reaction.id,
			createdAt: reaction.createdAt.toISOString(),
			user: await this.userEntityService.pack(reaction.userId, me),
			type: this.reactionService.convertLegacyReaction(reaction.reaction),
			...(opts.withNote ? {
				note: await this.noteEntityService.pack(reaction.noteId, me),
			} : {}),
		};
	}
}
