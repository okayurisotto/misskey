import { Injectable } from '@nestjs/common';
import type { IPoll } from '@/models/entities/Poll.js';
import { isQuestion } from '../type.js';
import { ApResolverService } from '../ApResolverService.js';
import type { Resolver } from '../ApResolverService.js';
import type { IObject } from '../type.js';

@Injectable()
export class ApQuestionExtractService {
	constructor(private readonly apResolverService: ApResolverService) {}

	public async extractPoll(
		source: string | IObject,
		resolver?: Resolver,
	): Promise<IPoll> {
		if (resolver == null) resolver = this.apResolverService.createResolver();

		const question = await resolver.resolve(source);
		if (!isQuestion(question)) throw new Error('invalid type');

		const multiple = question.oneOf === undefined;
		if (multiple && question.anyOf === undefined)
			throw new Error('invalid question');

		const expiresAt = question.endTime
			? new Date(question.endTime)
			: question.closed
			? new Date(question.closed)
			: null;

		const choices =
			question[multiple ? 'anyOf' : 'oneOf']
				?.map((x) => x.name)
				.filter((x): x is string => typeof x === 'string') ?? [];

		const votes = question[multiple ? 'anyOf' : 'oneOf']?.map(
			(x) => x.replies?.totalItems ?? x._misskey_votes ?? 0,
		);

		return { choices, votes, multiple, expiresAt };
	}
}
