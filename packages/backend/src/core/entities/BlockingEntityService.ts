import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { BlockingsRepository } from '@/models/index.js';
import type { Blocking } from '@/models/entities/Blocking.js';
import type { User } from '@/models/entities/User.js';
import { bindThis } from '@/decorators.js';
import type { BlockingSchema } from '@/models/zod/BlockingSchema.js';
import { UserEntityService } from './UserEntityService.js';
import type z from 'zod';

@Injectable()
export class BlockingEntityService {
	constructor(
		@Inject(DI.blockingsRepository)
		private blockingsRepository: BlockingsRepository,

		private userEntityService: UserEntityService,
	) {}

	@bindThis
	public async pack(
		src: Blocking['id'] | Blocking,
		me?: { id: User['id'] } | null | undefined,
	): Promise<z.infer<typeof BlockingSchema>> {
		const blocking =
			typeof src === 'object'
				? src
				: await this.blockingsRepository.findOneByOrFail({ id: src });

		return {
			id: blocking.id,
			createdAt: blocking.createdAt.toISOString(),
			blockeeId: blocking.blockeeId,
			blockee: await this.userEntityService.pack(blocking.blockeeId, me, {
				detail: true,
			}),
		};
	}
}
