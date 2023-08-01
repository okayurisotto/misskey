import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { ApPersonService } from '@/core/activitypub/models/ApPersonService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

export const meta = {
	tags: ['federation'],
	requireCredential: true,
} as const;

export const paramDef = z.object({
	userId: misskeyIdPattern,
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private getterService: GetterService,
		private apPersonService: ApPersonService,
	) {
		super(meta, paramDef, async (ps) => {
			const user = await this.getterService.getRemoteUser(ps.userId);
			await this.apPersonService.updatePerson(user.uri!);
		});
	}
}
