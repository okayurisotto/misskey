import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import type { RemoteUser } from '@/models/entities/User.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import { ReactionDecodeService } from './ReactionDecodeService.js';
import type { Note, user } from '@prisma/client';

@Injectable()
export class ReactionDeleteService {
	constructor(
		private readonly apDeliverManagerService: ApDeliverManagerService,
		private readonly apRendererService: ApRendererService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
		private readonly reactionDecodeService: ReactionDecodeService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	public async delete(
		user: { id: user['id']; host: user['host']; isBot: user['isBot'] },
		note: Note,
	): Promise<void> {
		// if already unreacted
		const exist = await this.prismaService.client.note_reaction.findUnique({
			where: {
				userId_noteId: {
					noteId: note.id,
					userId: user.id,
				},
			},
		});

		if (exist == null) {
			throw new IdentifiableError(
				'60527ec9-b4cb-4a88-a6bd-32d3ad26817d',
				'not reacted',
			);
		}

		// Delete reaction
		await this.prismaService.client.note_reaction
			.delete({ where: { id: exist.id } })
			.catch(() => {
				throw new IdentifiableError(
					'60527ec9-b4cb-4a88-a6bd-32d3ad26817d',
					'not reacted',
				);
			});

		// Decrement reactions count
		await this.prismaService.client.$transaction(async (client) => {
			const data = await client.note.findUniqueOrThrow({
				where: { id: note.id },
			});

			const reactions = z
				.record(z.string(), z.number().int())
				.parse(data.reactions);

			await client.note.update({
				where: { id: note.id },
				data: {
					reactions: Object.fromEntries(
						Object.entries(reactions).map(([k, v]) => {
							if (k !== exist.reaction) return [k, v];
							return [k, v - 1];
						}),
					),
				},
			});
		});

		if (!user.isBot) {
			await this.prismaService.client.note.update({
				where: { id: note.id },
				data: { score: { decrement: 1 } },
			});
		}

		this.globalEventService.publishNoteStream(note.id, 'unreacted', {
			reaction: this.reactionDecodeService.decode(exist.reaction).reaction,
			userId: user.id,
		});

		//#region 配信
		if (this.userEntityUtilService.isLocalUser(user) && !note.localOnly) {
			const content = this.apRendererService.addContext(
				this.apRendererService.renderUndo(
					await this.apRendererService.renderLike(exist, note),
					user,
				),
			);
			const dm = this.apDeliverManagerService.createDeliverManager(
				user,
				content,
			);
			if (note.userHost !== null) {
				const reactee = await this.prismaService.client.user.findUnique({
					where: { id: note.userId },
				});
				dm.addDirectRecipe(reactee as RemoteUser);
			}
			dm.addFollowersRecipe();
			await dm.execute();
		}
		//#endregion
	}
}
