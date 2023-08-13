import { Inject, Injectable } from '@nestjs/common';
import promiseLimit from 'promise-limit';
import { DI } from '@/di-symbols.js';
import type { User } from '@/models/index.js';
import type { Config } from '@/config.js';
import { toArray, unique } from '@/misc/prelude/array.js';
import { bindThis } from '@/decorators.js';
import { isMention } from '../type.js';
import { ApResolverService, Resolver } from '../ApResolverService.js';
import { ApPersonService } from './ApPersonService.js';
import type { IObject, IApMention } from '../type.js';
import type { user } from '@prisma/client';

@Injectable()
export class ApMentionService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		private apResolverService: ApResolverService,
		private apPersonService: ApPersonService,
	) {
	}

	@bindThis
	public async extractApMentions(tags: IObject | IObject[] | null | undefined, resolver: Resolver): Promise<user[]> {
		const hrefs = unique(this.extractApMentionObjects(tags).map(x => x.href));

		const limit = promiseLimit<user | null>(2);
		const mentionedUsers = (await Promise.all(
			hrefs.map(x => limit(() => this.apPersonService.resolvePerson(x, resolver).catch(() => null))),
		)).filter((x): x is user => x != null);

		return mentionedUsers;
	}

	@bindThis
	public extractApMentionObjects(tags: IObject | IObject[] | null | undefined): IApMention[] {
		if (tags == null) return [];
		return toArray(tags).filter(isMention);
	}
}
