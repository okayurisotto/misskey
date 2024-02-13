import { Injectable } from '@nestjs/common';
import promiseLimit from 'promise-limit';
import { toArray, unique } from '@/misc/prelude/array.js';
import { isMention } from '../type.js';
import { Resolver } from '../ApResolverService.js';
import { ApPersonResolveService } from './ApPersonResolveService.js';
import type { IObject, IApMention } from '../type.js';
import type { User } from '@prisma/client';

@Injectable()
export class ApMentionService {
	constructor(
		private readonly apPersonResolveService: ApPersonResolveService,
	) {}

	public async extractApMentions(
		tags: IObject | IObject[] | null | undefined,
		resolver: Resolver,
	): Promise<User[]> {
		const hrefs = unique(this.extractApMentionObjects(tags).map((x) => x.href));

		const limit = promiseLimit<User | null>(2);
		const mentionedUsers = (
			await Promise.all(
				hrefs.map((x) =>
					limit(() =>
						this.apPersonResolveService.resolve(x, resolver).catch(() => null),
					),
				),
			)
		).filter((x): x is User => x != null);

		return mentionedUsers;
	}

	public extractApMentionObjects(
		tags: IObject | IObject[] | null | undefined,
	): IApMention[] {
		if (tags == null) return [];
		return toArray(tags).filter(isMention);
	}
}
