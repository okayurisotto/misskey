import { Injectable } from '@nestjs/common';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { IdService } from '@/core/IdService.js';
import { RelayService } from '@/core/RelayService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { RoleService } from '@/core/RoleService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { Note, user } from '@prisma/client';

@Injectable()
export class NotePiningService {
	constructor(
		private readonly apDeliverManagerService: ApDeliverManagerService,
		private readonly apRendererService: ApRendererService,
		private readonly configLoaderService: ConfigLoaderService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
		private readonly relayService: RelayService,
		private readonly roleService: RoleService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	/**
	 * 指定した投稿をピン留めします
	 * @param user
	 * @param noteId
	 */
	public async addPinned(
		user: { id: user['id']; host: user['host'] },
		noteId: string,
	): Promise<void> {
		// Fetch pinee
		const note = await this.prismaService.client.note.findUnique({
			where: {
				id: noteId,
				userId: user.id,
			},
		});

		if (note == null) {
			throw new IdentifiableError(
				'70c4e51f-5bea-449c-a030-53bee3cce202',
				'No such note.',
			);
		}

		const pinings = await this.prismaService.client.user_note_pining.findMany({
			where: { userId: user.id },
		});

		if (
			pinings.length >=
			(await this.roleService.getUserPolicies(user.id)).pinLimit
		) {
			throw new IdentifiableError(
				'15a018eb-58e5-4da1-93be-330fcc5e4e1a',
				'You can not pin notes any more.',
			);
		}

		if (pinings.some((pining) => pining.noteId === note.id)) {
			throw new IdentifiableError(
				'23f0cf4e-59a3-4276-a91d-61a5891c1514',
				'That note has already been pinned.',
			);
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
		if (this.userEntityUtilService.isLocalUser(user)) {
			this.deliverPinnedChange(user.id, note.id, true);
		}
	}

	/**
	 * 指定した投稿のピン留めを解除します
	 * @param user
	 * @param noteId
	 */
	public async removePinned(
		user: { id: user['id']; host: user['host'] },
		noteId: string,
	): Promise<void> {
		// Fetch unpinee
		const note = await this.prismaService.client.note.findUnique({
			where: {
				id: noteId,
				userId: user.id,
			},
		});

		if (note == null) {
			throw new IdentifiableError(
				'b302d4cf-c050-400a-bbb3-be208681f40c',
				'No such note.',
			);
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
		if (this.userEntityUtilService.isLocalUser(user)) {
			await this.deliverPinnedChange(user.id, noteId, false);
		}
	}

	public async deliverPinnedChange(
		userId: string,
		noteId: string,
		isAddition: boolean,
	): Promise<void> {
		const user = await this.prismaService.client.user.findUnique({
			where: { id: userId },
		});
		if (user == null) throw new Error('user not found');

		if (!this.userEntityUtilService.isLocalUser(user)) return;

		const target = `${this.configLoaderService.data.url}/users/${user.id}/collections/featured`;
		const item = `${this.configLoaderService.data.url}/notes/${noteId}`;
		const content = this.apRendererService.addContext(
			isAddition
				? this.apRendererService.renderAdd(user, target, item)
				: this.apRendererService.renderRemove(user, target, item),
		);

		this.apDeliverManagerService.deliverToFollowers(user, content);
		this.relayService.deliverToRelays(user, content);
	}
}
