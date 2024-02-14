import { fromEntries } from 'omick';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import { isNotNull } from '@/misc/is-not-null.js';
import { CustomEmojiStringParseService } from './CustomEmojiStringParseService.js';

@Injectable()
export class CustomEmojiPopulateService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly customEmojiStringParseService: CustomEmojiStringParseService,
	) {}

	/**
	 * 複数の添付用（リモート）カスタム絵文字URLを解決する（存在しないものは結果から除外される）
	 *
	 * @param emojiNames ノートやユーザープロフィールに添付された、またはリアクションのカスタム絵文字名（`:`は含めない。リアクションでローカルホストの場合は`@.`を付ける（これはdecodeReactionで可能））
	 * @param host       ノートやユーザープロフィールの所有者のホスト
	 */
	public async populate(
		emojiNames: string[],
		host: string | null,
	): Promise<Record<string, string>> {
		const parsedEmojiNames = emojiNames
			.map((emojiName) => {
				const result = this.customEmojiStringParseService.parse(
					emojiName,
					host,
				);
				if (result === null) return null;
				if (result.host === null) return null;

				return { value: emojiName, result: result };
			})
			.filter(isNotNull);

		const emojis = await this.prismaService.client.customEmoji.findMany({
			where: { OR: parsedEmojiNames.map(({ result: specifier }) => specifier) },
		});

		const entries = emojis
			.map<[string, string] | null>((emoji) => {
				const emojiName = parsedEmojiNames.find((entry) => {
					return (
						entry.result.host === emoji.host && entry.result.name === emoji.name
					);
				});

				if (emojiName === undefined) return null;

				// 後方互換性のため
				const emojiUrl =
					emoji.publicUrl === '' ? emoji.originalUrl : emoji.publicUrl;

				return [emojiName.value, emojiUrl];
			})
			.filter(isNotNull);

		return fromEntries(entries);
	}
}
