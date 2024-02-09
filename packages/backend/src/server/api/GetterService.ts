import { Injectable } from '@nestjs/common';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import type { LocalUser, RemoteUser } from '@/models/entities/User.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';
import type { Note, user } from '@prisma/client';

@Injectable()
export class GetterService {
	constructor(
		private readonly userEntityService: UserEntityService,
		private readonly prismaService: PrismaService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {}

	/**
	 * Get note for API processing
	 */
	public async getNote(noteId: Note['id']): Promise<Note> {
		const note = await this.prismaService.client.note.findUnique({
			where: { id: noteId },
		});

		if (note == null) {
			throw new IdentifiableError(
				'9725d0ce-ba28-4dde-95a7-2cbb2c15de24',
				'No such note.',
			);
		}

		return note;
	}

	/**
	 * Get user for API processing
	 */
	public async getUser(userId: user['id']): Promise<LocalUser | RemoteUser> {
		const user = await this.prismaService.client.user.findUnique({
			where: { id: userId },
		});

		if (user == null) {
			throw new IdentifiableError(
				'15348ddd-432d-49c2-8a5a-8069753becff',
				'No such user.',
			);
		}

		return user as LocalUser | RemoteUser;
	}

	/**
	 * Get remote user for API processing
	 */
	public async getRemoteUser(userId: user['id']): Promise<RemoteUser> {
		const user = await this.getUser(userId);

		if (!this.userEntityUtilService.isRemoteUser(user)) {
			throw new Error('user is not a remote user');
		}

		return user;
	}

	/**
	 * Get local user for API processing
	 */
	public async getLocalUser(userId: user['id']): Promise<LocalUser> {
		const user = await this.getUser(userId);

		if (!this.userEntityUtilService.isLocalUser(user)) {
			throw new Error('user is not a local user');
		}

		return user;
	}
}
