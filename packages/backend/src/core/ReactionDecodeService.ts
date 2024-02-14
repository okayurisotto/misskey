import { Injectable } from '@nestjs/common';

type DecodedReaction = {
	/**
	 * リアクション名 (Unicode Emoji or ':name@hostname' or ':name@.')
	 */
	reaction: string;

	/**
	 * name (カスタム絵文字の場合name, Emojiクエリに使う)
	 */
	name?: string;

	/**
	 * host (カスタム絵文字の場合host, Emojiクエリに使う)
	 */
	host?: string | null;
};

const DECODE_CUSTOM_EMOJI_REGEXP = /^:([\w+-]+)(?:@([\w.-]+))?:$/;

@Injectable()
export class ReactionDecodeService {
	public decode(str: string): DecodedReaction {
		const custom = str.match(DECODE_CUSTOM_EMOJI_REGEXP);

		if (custom) {
			const name = custom.at(1);
			const host = custom.at(2) ?? null;

			return {
				reaction: `:${name}@${host ?? '.'}:`, // ローカル分は@以降を省略するのではなく.にする
				name,
				host,
			};
		}

		return {
			reaction: str,
			name: undefined,
			host: undefined,
		};
	}
}
