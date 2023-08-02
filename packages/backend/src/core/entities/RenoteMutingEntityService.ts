import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { RenoteMutingsRepository } from '@/models/index.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { } from '@/models/entities/Blocking.js';
import type { User } from '@/models/entities/User.js';
import type { RenoteMuting } from '@/models/entities/RenoteMuting.js';
import { bindThis } from '@/decorators.js';
import type { RenoteMutingSchema } from '@/models/zod/RenoteMutingSchema.js';
import { UserEntityService } from './UserEntityService.js';
import type { z } from 'zod';

@Injectable()
export class RenoteMutingEntityService {
	constructor(
		@Inject(DI.renoteMutingsRepository)
		private renoteMutingsRepository: RenoteMutingsRepository,

		private userEntityService: UserEntityService,
	) {
	}

	@bindThis
	public async pack(
		src: RenoteMuting['id'] | RenoteMuting,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof RenoteMutingSchema>> {
		const muting = typeof src === 'object' ? src : await this.renoteMutingsRepository.findOneByOrFail({ id: src });

		return ({
			id: muting.id,
			createdAt: muting.createdAt.toISOString(),
			muteeId: muting.muteeId,
			mutee: await this.userEntityService.pack(muting.muteeId, me, { detail: true }),
		});
	}

	@bindThis
	public packMany(
		mutings: any[],
		me: { id: User['id'] },
	) {
		return Promise.all(mutings.map(x => this.pack(x, me)));
	}
}

