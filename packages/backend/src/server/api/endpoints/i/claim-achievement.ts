import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
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

const paramDef_ = z.object({
	name: z.enum(ACHIEVEMENT_TYPES),
});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(private achievementService: AchievementService) {
		super(meta, paramDef_, async (ps, me) => {
			await this.achievementService.create(me.id, ps.name);
		});
	}
}
