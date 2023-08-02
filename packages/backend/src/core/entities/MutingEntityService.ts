import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { MutingsRepository } from '@/models/index.js';
import type { } from '@/models/entities/Blocking.js';
import type { User } from '@/models/entities/User.js';
import type { Muting } from '@/models/entities/Muting.js';
import { bindThis } from '@/decorators.js';
import type { MutingSchema } from '@/models/zod/MutingSchema.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';

@Injectable()
export class MutingEntityService {
	constructor(
		@Inject(DI.mutingsRepository)
		private mutingsRepository: MutingsRepository,

		private userEntityService: UserEntityService,
	) {
	}

	@bindThis
	public async pack(
		src: Muting['id'] | Muting,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof MutingSchema>> {
		const muting = typeof src === 'object' ? src : await this.mutingsRepository.findOneByOrFail({ id: src });

		return {
			id: muting.id,
			createdAt: muting.createdAt.toISOString(),
			expiresAt: muting.expiresAt ? muting.expiresAt.toISOString() : null,
			muteeId: muting.muteeId,
			mutee: await this.userEntityService.pack(muting.muteeId, me, { detail: true }),
		};
	}

	@bindThis
	public packMany(
		mutings: any[],
		me: { id: User['id'] },
	) {
		return Promise.all(mutings.map(x => this.pack(x, me)));
	}
}

