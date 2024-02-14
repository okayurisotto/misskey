import { Injectable } from '@nestjs/common';
import { fromEntries, toEntries } from 'omick';
import { LEGACY_REACTIONS } from '@/const.js';
import { ReactionDecodeService } from './ReactionDecodeService.js';

@Injectable()
export class LegacyReactionConvertService {
	constructor(private readonly reactionDecodeService: ReactionDecodeService) {}

	public convert(reaction: string): string {
		const decodedReaction = this.reactionDecodeService.decode(reaction);
		const reaction_ = decodedReaction.reaction;
		const legacy = LEGACY_REACTIONS.get(reaction_);
		if (legacy !== undefined) return legacy;
		return reaction_;
	}

	public convertAll(reactions: Record<string, number>): Record<string, number> {
		return fromEntries([
			...toEntries(reactions).reduce((acc, [reaction, count]) => {
				const key = this.convert(reaction);
				const value = (acc.get(key) ?? 0) + count;
				return acc.set(key, value);
			}, new Map<string, number>()),
		]);
	}
}
