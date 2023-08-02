import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { AuthSessionsRepository } from '@/models/index.js';
import type { AuthSession } from '@/models/entities/AuthSession.js';
import type { User } from '@/models/entities/User.js';
import { bindThis } from '@/decorators.js';
import { AppEntityService } from './AppEntityService.js';

@Injectable()
export class AuthSessionEntityService {
	constructor(
		@Inject(DI.authSessionsRepository)
		private authSessionsRepository: AuthSessionsRepository,

		private appEntityService: AppEntityService,
	) {
	}

	@bindThis
	public async pack(
		src: AuthSession['id'] | AuthSession,
		me?: { id: User['id'] } | null | undefined,
	) {
		const session = typeof src === 'object' ? src : await this.authSessionsRepository.findOneByOrFail({ id: src });

		return {
			id: session.id,
			app: await this.appEntityService.pack(session.appId, me),
			token: session.token,
		};
	}
}
