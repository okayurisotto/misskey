import { Injectable } from '@nestjs/common';
import { ReactionDecodeService } from './ReactionDecodeService.js';

const legacies: Record<string, string> = {
	like: '👍',
	love: '❤', // ここに記述する場合は異体字セレクタを入れない
	laugh: '😆',
	hmm: '🤔',
	surprise: '😮',
	congrats: '🎉',
	angry: '💢',
	confused: '😥',
	rip: '😇',
	pudding: '🍮',
	star: '⭐',
};

@Injectable()
export class LegacyReactionConvertService {
	constructor(private readonly reactionDecodeService: ReactionDecodeService) {}

	public convert(reaction: string): string {
		const reaction_ = this.reactionDecodeService.decode(reaction).reaction;
		if (Object.keys(legacies).includes(reaction_)) return legacies[reaction_];
		return reaction_;
	}

	public convertAll(reactions: Record<string, number>): Record<string, number> {
		const reactions_ = {} as Record<string, number>;

		for (const reaction of Object.keys(reactions)) {
			if (reactions[reaction] <= 0) continue;

			if (Object.keys(legacies).includes(reaction)) {
				if (reactions_[legacies[reaction]]) {
					reactions_[legacies[reaction]] += reactions[reaction];
				} else {
					reactions_[legacies[reaction]] = reactions[reaction];
				}
			} else {
				if (reactions_[reaction]) {
					reactions_[reaction] += reactions[reaction];
				} else {
					reactions_[reaction] = reactions[reaction];
				}
			}
		}

		const _reactions2 = {} as Record<string, number>;

		for (const reaction of Object.keys(reactions_)) {
			_reactions2[this.reactionDecodeService.decode(reaction).reaction] =
				reactions_[reaction];
		}

		return _reactions2;
	}
}
