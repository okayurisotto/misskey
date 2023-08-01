import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type { FollowingsRepository, UsersRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import { QueueService } from '@/core/QueueService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = z.object({
	host: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private followingsRepository: FollowingsRepository,

		private queueService: QueueService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const followings = await this.followingsRepository.findBy({
				followerHost: ps.host,
			});

			const pairs = await Promise.all(
				followings.map((f) =>
					Promise.all([
						this.usersRepository.findOneByOrFail({ id: f.followerId }),
						this.usersRepository.findOneByOrFail({ id: f.followeeId }),
					]).then(([from, to]) => [{ id: from.id }, { id: to.id }]),
				),
			);

			this.queueService.createUnfollowJob(
				pairs.map((p) => ({ from: p[0], to: p[1], silent: true })),
			);
		});
	}
}
