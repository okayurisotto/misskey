import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import {
	AchievementService,
	ACHIEVEMENT_TYPES,
} from '@/core/AchievementService.js';

export const meta = {
	requireCredential: true,
	prohibitMoved: true,
} as const;

export const paramDef = z.object({
	name: z.enum(ACHIEVEMENT_TYPES),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private readonly achievementService: AchievementService) {
		super(meta, paramDef, async (ps, me) => {
			await this.achievementService.create(me.id, ps.name);
		});
	}
}
