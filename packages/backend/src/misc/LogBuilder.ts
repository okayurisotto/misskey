import chalk, { ChalkInstance } from 'chalk';
import convertColor from 'color-convert';
import { format as dateFormat } from 'date-fns';
import type { KEYWORD } from 'color-convert/conversions.js';

/** ログ種別と接頭辞の対応 */
const logPrefixes = {
	error: 'ERR',
	success: 'DONE',
	warning: 'WARN',
	debug: 'VERB',
	info: 'INFO',
} as const satisfies Record<string, string>;

/** ログ種別 */
export type LogLevel = keyof typeof logPrefixes;

/** ログ自体に「どういった文脈で発生したものか」を含めるために使われるデータ */
export type LoggerContext = {
	/** 文脈の識別子 */
	name: string;
	/** 装飾する色 */
	color?: KEYWORD;
};

/** 生成するログを色付けなどの装飾を施した上で組み立てるユーティリティクラス */
export class LogBuilder {
	/** ログ種別に応じた接頭辞の最大長。これより短いものは空白によって位置を調整される。 */
	private readonly LOG_PREFIX_MAX_LENGTH = 4;

	private readonly levelPrefix;
	private _withTimestamp: boolean | null;
	private worker = '?';
	private contexts: string | null = null;
	private message: string | null = null;

	/**
	 * @param levelPrefix 生成するログの種別。この種類に応じてログ文字列に接頭辞が与えられる。
	 * @param important 生成するログが重要なものである場合は`true`を渡す。デフォルトは`false`。
	 */
	constructor(
		private readonly level: LogLevel,
		private readonly important = false,
	) {
		let chalkInstance: ChalkInstance;

		switch (level) {
			case 'error': {
				if (important) {
					chalkInstance = chalk.bgRed.white;
				} else {
					chalkInstance = chalk.red;
				}
				break;
			}
			case 'success': {
				if (important) {
					chalkInstance = chalk.bgGreen.white;
				} else {
					chalkInstance = chalk.green;
				}
				break;
			}
			case 'warning': {
				chalkInstance = chalk.yellow;
				break;
			}
			case 'debug': {
				chalkInstance = chalk.green;
				break;
			}
			case 'info': {
				chalkInstance = chalk.blue;
				break;
			}
		}

		this.levelPrefix = chalkInstance(logPrefixes[level]).padEnd(
			this.LOG_PREFIX_MAX_LENGTH,
		);
	}

	/**
	 * クラスタを構成するワーカーのIDを示す。
	 *
	 * @param id ワーカーでないことを表すには`null`を渡す。
	 */
	public withWorker(id: number | null): this {
		if (id === null) {
			this.worker = '*';
		} else {
			this.worker = id.toString();
		}

		return this;
	}

	/**
	 * どういった文脈で発生したログなのか設定する。
	 */
	public withContexts(contexts: LoggerContext[]): this {
		this.contexts = contexts
			.map((context) => {
				if (context.color) {
					return chalk.rgb(...convertColor.keyword.rgb(context.color))(
						context.name,
					);
				} else {
					return chalk.white(context.name);
				}
			})
			.join(' ');

		return this;
	}

	/**
	 * タイムスタンプをログに含めるか設定する。デフォルトでは含めない。
	 *
	 * 実際に`.build()`が呼ばれるまではタイムスタンプ文字列の生成は行われない。
	 */
	public withTimestamp(yes: boolean): this {
		this._withTimestamp = yes;

		return this;
	}

	private tintMessage(message: string): string {
		switch (this.level) {
			case 'error': {
				return chalk.red(message);
			}
			case 'success': {
				return chalk.green(message);
			}
			case 'warning': {
				return chalk.yellow(message);
			}
			case 'debug': {
				return chalk.gray(message);
			}
			case 'info': {
				return message;
			}
		}
	}

	/**
	 * 文字列によるメッセージをログに含める。
	 *
	 * `withError()`とは排他。
	 */
	public withMessage(message: string): this {
		this.message = this.tintMessage(message);

		return this;
	}

	/**
	 * エラーによるメッセージをログに含める。
	 *
	 * `withMessage()`とは排他。
	 */
	public withError(error: Error): this {
		this.message = this.tintMessage(`Error: ${error.message}`);

		return this;
	}

	/**
	 * 設定に基づきログ文字列を得る。
	 */
	public build(): string {
		// 関心の分離のため、できる限りこのメソッドでは複雑なことはせず、各メソッドで処理する。

		// 時間を得るのは実際に文字列を出力する直前になってから。
		const time = this._withTimestamp
			? dateFormat(new Date(), 'HH:mm:ss') + ' '
			: '';

		const log =
			time +
			this.levelPrefix +
			' ' +
			this.worker +
			'\t' +
			`[${this.contexts}]` +
			'\t' +
			this.message;

		if (this.important) {
			return chalk.bold(log);
		} else {
			return log;
		}
	}
}
