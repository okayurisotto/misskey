import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import type { User } from '@/models/entities/User.js';
import type { Note } from '@/models/entities/Note.js';
import { IdService } from '@/core/IdService.js';
import { RelayService } from '@/core/RelayService.js';
import type { Config } from '@/config.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { PrismaService } from '@/core/PrismaService.js';

@Injectable()
export class NotePiningService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		private readonly userEntityService: UserEntityService,
		private readonly idService: IdService,
		private readonly roleService: RoleService,
		private readonly relayService: RelayService,
		private readonly apDeliverManagerService: ApDeliverManagerService,
		private readonly apRendererService: ApRendererService,
		private readonly prismaService: PrismaService,
	) {
	}

	/**
	 * 指定した投稿をピン留めします
	 * @param user
	 * @param noteId
	 */
	@bindThis
	public async addPinned(user: { id: User['id']; host: User['host']; }, noteId: Note['id']) {
	// Fetch pinee
		const note = await this.prismaService.client.note.findUnique({
			where: {
				id: noteId,
				userId: user.id,
			},
		});

		if (note == null) {
			throw new IdentifiableError('70c4e51f-5bea-449c-a030-53bee3cce202', 'No such note.');
		}

		const pinings = await this.prismaService.client.user_note_pining.findMany({ where: { userId: user.id } });

		if (pinings.length >= (await this.roleService.getUserPolicies(user.id)).pinLimit) {
			throw new IdentifiableError('15a018eb-58e5-4da1-93be-330fcc5e4e1a', 'You can not pin notes any more.');
		}

		if (pinings.some(pining => pining.noteId === note.id)) {
			throw new IdentifiableError('23f0cf4e-59a3-4276-a91d-61a5891c1514', 'That note has already been pinned.');
		}

		await this.prismaService.client.user_note_pining.create({
			data: {
				id: this.idService.genId(),
				createdAt: new Date(),
				userId: user.id,
				noteId: note.id,
			},
		});

		// Deliver to remote followers
		if (this.userEntityService.isLocalUser(user)) {
			this.deliverPinnedChange(user.id, note.id, true);
		}
	}

	/**
	 * 指定した投稿のピン留めを解除します
	 * @param user
	 * @param noteId
	 */
	@bindThis
	public async removePinned(user: { id: User['id']; host: User['host']; }, noteId: Note['id']) {
		// Fetch unpinee
		const note = await this.prismaService.client.note.findUnique({
			where: {
				id: noteId,
				userId: user.id,
			},
		});

		if (note == null) {
			throw new IdentifiableError('b302d4cf-c050-400a-bbb3-be208681f40c', 'No such note.');
		}

		await this.prismaService.client.user_note_pining.delete({
			where: {
				userId_noteId: {
					userId: user.id,
					noteId: note.id,
				},
			},
		});

		// Deliver to remote followers
		if (this.userEntityService.isLocalUser(user)) {
			await this.deliverPinnedChange(user.id, noteId, false);
		}
	}

	@bindThis
	public async deliverPinnedChange(userId: User['id'], noteId: Note['id'], isAddition: boolean) {
		const user = await this.prismaService.client.user.findUnique({ where: { id: userId } });
		if (user == null) throw new Error('user not found');

		if (!this.userEntityService.isLocalUser(user)) return;

		const target = `${this.config.url}/users/${user.id}/collections/featured`;
		const item = `${this.config.url}/notes/${noteId}`;
		const content = this.apRendererService.addContext(isAddition ? this.apRendererService.renderAdd(user, target, item) : this.apRendererService.renderRemove(user, target, item));

		this.apDeliverManagerService.deliverToFollowers(user, content);
		this.relayService.deliverToRelays(user, content);
	}
}
