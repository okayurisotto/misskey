import { Injectable } from '@nestjs/common';
import { UtilityService } from '@/core/UtilityService.js';

const PARSE_EMOJI_STR_REGEXP = /^(\w+)(?:@([\w.-]+))?$/;

@Injectable()
export class CustomEmojiStringParseService {
	constructor(private readonly utilityService: UtilityService) {}

	private normalizeHost(
		src: string | undefined,
		noteUserHost: string | null,
	): string | null {
		const host = ((): string | null => {
			// .はローカルホスト (ここがマッチするのはリアクションのみ)
			if (src === '.') return null;

			// ノートなどでホスト省略表記の場合はローカルホスト (ここがリアクションにマッチすることはない)
			if (src === undefined) return noteUserHost;

			// 自ホスト指定
			if (this.utilityService.isSelfHost(src)) return null;

			// 指定されたホスト || ノートなどの所有者のホスト (こっちがリアクションにマッチすることはない)
			return src || noteUserHost;
		})();

		return this.utilityService.toPunyNullable(host);
	}

	public parse(
		emojiName: string,
		noteUserHost: string | null,
	):
		| { name: null; host: null }
		| { name: string | undefined; host: string | null } {
		const match = emojiName.match(PARSE_EMOJI_STR_REGEXP);
		if (!match) return { name: null, host: null };

		const name = match.at(1);

		// ホスト正規化
		const host = this.utilityService.toPunyNullable(
			this.normalizeHost(match.at(2), noteUserHost),
		);

		return { name, host };
	}
}
