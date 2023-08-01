import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { RelayService } from '@/core/RelayService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = z.object({
	inbox: z.string(),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(private relayService: RelayService) {
		super(meta, paramDef, async (ps, me) => {
			await this.relayService.removeRelay(ps.inbox);
		});
	}
}
