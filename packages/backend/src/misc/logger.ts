import cluster from 'node:cluster';
import { NODE_ENV, envOption } from '@/env.js';
import {
	LogBuilder,
	type LoggerContext,
	type LogLevel,
} from '@/misc/LogBuilder.js';
import type { KEYWORD } from 'color-convert/conversions.js';

/**
 * 汎用的なロガー
 *
 * 表示するログの種類（文脈）ごとにいくつかのものを作って使い分けることが推奨される。
 */
// eslint-disable-next-line import/no-default-export
export default class Logger {
	private readonly context;
	private parentLogger: Logger | null = null;

	/**
	 * @param contextName 作成するロガーにつける名前。ログに含まれるようになる。
	 * @param contextColor `contextName`を出力ログに含めるときに装飾として使われる色
	 */
	constructor(contextName: string, contextColor?: KEYWORD) {
		this.context = {
			name: contextName,
			color: contextColor,
		};
	}

	/**
	 * このロガーを元にした新たなロガーを作る。
	 *
	 * サブロガーは親ロガーについての情報を持ち、実際のログ出力処理は親へ任せる。
	 * 親は子から任されたログを出力するが、このときどの子から任されたのかを出力するログに含めるようになる。
	 *
	 * @param contextName 作成するサブロガーにつける名前。ログに含まれるようになる。
	 * @param contextColor `contextName`を出力ログに含めるときに装飾として使われる色
	 */
	public createSubLogger(contextName: string, contextColor?: KEYWORD): Logger {
		const logger = new Logger(contextName, contextColor);
		logger.parentLogger = this;
		return logger;
	}

	/**
	 * 実際にログを出力する。
	 *
	 * @param level ログ種別
	 * @param message メッセージ
	 * @param data 追加で出力したいデータ
	 * @param important このログが重要であるか
	 * @param subContexts 内部的に使っている引数。明示的な指定は想定されていない。
	 */
	private log(
		level: LogLevel,
		message: string,
		data?: unknown,
		important = false,
		subContexts: LoggerContext[] = [],
	): void {
		if (envOption.quiet) return;

		const contexts = [this.context, ...subContexts];

		if (this.parentLogger) {
			this.parentLogger.log(level, message, data, important, contexts);
			return;
		}

		const log = new LogBuilder(level, important)
			.withContexts(contexts)
			.withTimestamp(envOption.withLogTime)
			.withWorker(cluster.worker?.id ?? null)
			.withMessage(message)
			.build();

		console.log(log);
		if (level === 'error' && data != null) {
			console.log(data);
		}
	}

	/**
	 * 実行を継続できない状況で使う。
	 */
	public error(value: string | Error, data?: unknown, important = false): void {
		if (value instanceof Error) {
			if (typeof data === 'object') {
				this.log('error', value.toString(), { ...data, e: value }, important);
			} else {
				this.log('error', value.toString(), { e: value }, important);
			}
		} else {
			this.log('error', value, data, important);
		}
	}

	/**
	 * 実行を継続できるが改善が必要な状況で使う。
	 */
	public warn(message: string, important = false): void {
		this.log('warning', message, undefined, important);
	}

	/**
	 * 何かに成功した状況で使う。
	 */
	public succ(message: string, important = false): void {
		this.log('success', message, undefined, important);
	}

	/**
	 * 開発者に必要だが利用者に不要な情報を表示したい場面で使う。
	 * `NODE_ENV`が`'production'`だった場合は基本的に表示されない。
	 */
	public debug(message: string, important = false): void {
		if (NODE_ENV !== 'production' || envOption.verbose) {
			this.log('debug', message, undefined, important);
		}
	}

	/**
	 * 何らかの情報を表示したい場面で使う。
	 * これより適したメソッドがある場合はそれを使うべき。
	 */
	public info(message: string, important = false): void {
		this.log('info', message, undefined, important);
	}
}
