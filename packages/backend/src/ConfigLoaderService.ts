import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { pick } from 'omick';
import { PORT } from '@/env.js';
import { ID_GENERATION_METHODS } from '@/const.js';
import { CLIENT_MANIFEST_FILE, CONFIG_FILE, META_FILE } from './paths.js';
import { isIncludes } from './misc/typed-utils.js';
import type { ValueOf } from 'type-fest';

const ALLOWED_SCHEMAS = ['http', 'https'] as const;
type Schema = (typeof ALLOWED_SCHEMAS)[number];

const ALLOWED_WEBSOCKET_SCHEMAS = ['ws', 'wss'] as const;
type WebSocketSchema = (typeof ALLOWED_WEBSOCKET_SCHEMAS)[number];

/** サーバー管理者が設定する必要のあるRedisに関する情報 */
const RedisOptionsSourceSchema = z.object({
	host: z.string(),
	port: z.number(),
	family: z.number().default(0),
	pass: z.string().optional(),
	db: z.number().default(0),
	prefix: z.string().optional(),
});

/** サーバー管理者が設定する必要のある情報 */
const SourceSchema = z.object({
	url: z.string().url(),
	port: z.number().default(PORT ?? 3000),
	socket: z.string().optional(),
	allowedPrivateNetworks: z.string().array().default([]),
	chmodSocket: z.string().or(z.number().int().positive()).optional(),
	disableHsts: z.boolean().default(false),
	signToActivityPubGet: z.boolean().default(false),

	id: z.enum(ID_GENERATION_METHODS),

	db: z.object({
		host: z.string(),
		port: z.number(),
		db: z.string(),
		user: z.string(),
		pass: z.string(),
	}),

	redis: RedisOptionsSourceSchema,
	redisForPubsub: RedisOptionsSourceSchema.optional(),
	redisForJobQueue: RedisOptionsSourceSchema.optional(),

	meilisearch: z
		.object({
			host: z.string(),
			port: z.number(),
			apiKey: z.string(),
			ssl: z.boolean().default(false),
			index: z.string(),
			scope: z.enum(['local', 'global']).or(z.string().array()).optional(),
		})
		.optional(),

	proxy: z.string().optional(),
	proxySmtp: z.string().optional(),
	proxyBypassHosts: z.string().array().default([]),

	clusterLimit: z.number().default(1),
	deliverJobConcurrency: z.number().default(128),
	deliverJobMaxAttempts: z.number().default(12),
	deliverJobPerSec: z.number().default(128),
	inboxJobConcurrency: z.number().default(16),
	inboxJobMaxAttempts: z.number().default(8),
	inboxJobPerSec: z.number().default(16),
	relashionshipJobConcurrency: z.number().default(16), // typo?
	relashionshipJobPerSec: z.number().default(64), // typo?

	maxFileSize: z.number().default(262144000),
	mediaProxy: (z.string().endsWith('/') as z.ZodType<`${string}/`>)
		.nullable()
		.default(null),
	proxyRemoteFiles: z.boolean().default(false),
	videoThumbnailGenerator: (z.string().endsWith('/') as z.ZodType<`${string}/`>)
		.nullable()
		.default(null),

	accesslog: z.string().optional(), // unused?
	feedback_url: z.string().optional(), // unused?
	outgoingAddressFamily: z.enum(['ipv4', 'ipv6', 'dual']).optional(), // unused?
	repository_url: z.string().optional(), // unused?
});

/**
 * `build-pre.js`によって作られる`meta.json`のスキーマ
 *
 * `build-pre.js`は`package.json`からこの`meta.json`を作っている。
 */
const MetaSchema = z.object({
	version: z.string(),
});

/**
 * Viteが生成する`manifest.json`のスキーマ
 */
const ClientManifestSchema = z.record(
	z.string(),
	z.object({
		file: z.string(),
		css: z.string().array().optional(),
	}),
);

/** サーバー管理者が設定した情報から推論してMisskeyが自動的に設定する情報 */
type Mixin = {
	version: string;
	/** portも含まれる */
	host: string;
	/** portは含まれない */
	hostname: string;
	scheme: Schema;
	wsScheme: WebSocketSchema;
	apiUrl: `${Schema}://${string}/api`;
	wsUrl: `${WebSocketSchema}://${string}`;
	authUrl: `${Schema}://${string}/auth`;
	driveUrl: `${Schema}://${string}/files`;
	userAgent: string;
	clientEntry: ValueOf<z.infer<typeof ClientManifestSchema>>;
	clientManifestExists: boolean;
	mediaProxy: `${string}/`;
	externalMediaProxyEnabled: boolean;
	redis: z.infer<typeof RedisOptionsSourceSchema>;
	redisForPubsub: z.infer<typeof RedisOptionsSourceSchema>;
	redisForJobQueue: z.infer<typeof RedisOptionsSourceSchema>;
};

/**
 * Misskeyが動作する上で必要になるすべての設定
 *
 * サーバー管理者によって明示的に設定された項目と、Misskeyがそこから推論した項目の両方が含まれる。
 */
export type Config = z.infer<typeof SourceSchema> & Mixin;

/**
 * YAMLファイルによる設定の読み込みと解析をつかさどるサービス
 */
@Injectable()
export class ConfigLoaderService {
	/** 設定内容 */
	public readonly data = this.loadConfig();

	/**
	 * ファイルでされた設定を、`ioredis`の`Redis`クラスのコンストラクタに渡す設定に変換する。
	 */
	private convertRedisOptions(
		options: z.infer<typeof RedisOptionsSourceSchema>,
		host: string,
	): {
		db: number;
		family: number;
		host: string;
		keyPrefix: string;
		pass?: string;
		password?: string;
		port: number;
		prefix: string;
	} {
		return {
			...pick(options, ['db', 'family', 'host', 'pass', 'port']),
			keyPrefix: `${options.prefix ?? host}:`,
			password: options.pass,
			prefix: options.prefix ?? host,
		};
	}

	/**
	 * YAMLファイルを読み、スキーマに基づいてパースする。
	 */
	private loadConfigSource(path: string): z.infer<typeof SourceSchema> {
		const content = fs.readFileSync(path, 'utf-8');
		const data = yaml.load(content);
		const result = SourceSchema.parse(data);
		return result;
	}

	/**
	 * `meta.json`を読み、スキーマに基づいてパースする。
	 */
	private loadMeta(path: string): z.infer<typeof MetaSchema> {
		const content = fs.readFileSync(path, 'utf-8');
		const data: unknown = JSON.parse(content);
		const result = MetaSchema.parse(data);
		return result;
	}

	/**
	 * `manifest.json`を読み、スキーマに基づいてパースする。
	 * `manifest.json`が存在しなかった場合はデフォルト値にフォールバックされる。
	 */
	private loadClientManifest(path: string): {
		exist: boolean;
		data: z.infer<typeof ClientManifestSchema>;
	} {
		const exists = fs.existsSync(path);

		if (exists) {
			const content = fs.readFileSync(CLIENT_MANIFEST_FILE, 'utf-8');
			const data: unknown = JSON.parse(content);
			const result = ClientManifestSchema.parse(data);
			return {
				exist: true,
				data: result,
			};
		} else {
			return {
				exist: false,
				data: { 'src/_boot_.ts': { file: 'src/_boot_.ts' } },
			};
		}
	}

	/**
	 * 設定を読み込み、返り値として設定内容を返す。
	 */
	private loadConfig(): z.infer<typeof SourceSchema> & Mixin {
		const config = this.loadConfigSource(CONFIG_FILE);
		const meta = this.loadMeta(META_FILE);
		const { exist: clientManifestExists, data: clientManifest } =
			this.loadClientManifest(CLIENT_MANIFEST_FILE);

		const url = new URL(config.url); // すでにURLとしてパース可能なことは確認済み
		const version = meta.version;
		const host = url.host;
		const hostname = url.hostname;

		const scheme = url.protocol.replace(/:$/, '');
		if (!isIncludes(ALLOWED_SCHEMAS, scheme)) throw new Error();

		const wsScheme = scheme.replace('http', 'ws');
		if (!isIncludes(ALLOWED_WEBSOCKET_SCHEMAS, wsScheme)) throw new Error();

		const wsUrl = `${wsScheme}://${host}` as const;
		const apiUrl = `${scheme}://${host}/api` as const;
		const authUrl = `${scheme}://${host}/auth` as const;
		const driveUrl = `${scheme}://${host}/files` as const;

		const userAgent = `Misskey/${meta.version} (${config.url})`;

		const clientEntry = clientManifest['src/_boot_.ts'];

		const externalMediaProxy = config.mediaProxy;
		const internalMediaProxy = `${scheme}://${host}/proxy/` as const;
		const mediaProxy = externalMediaProxy ?? internalMediaProxy;
		const externalMediaProxyEnabled =
			externalMediaProxy !== null && externalMediaProxy !== internalMediaProxy;

		const redis = this.convertRedisOptions(config.redis, host);

		const redisForPubsub =
			config.redisForPubsub !== undefined
				? this.convertRedisOptions(config.redisForPubsub, host)
				: redis;

		const redisForJobQueue =
			config.redisForJobQueue !== undefined
				? this.convertRedisOptions(config.redisForJobQueue, host)
				: redis;

		const mixin: Mixin = {
			version,
			host,
			hostname,
			scheme,
			wsScheme,
			wsUrl,
			apiUrl,
			authUrl,
			driveUrl,
			userAgent,
			clientEntry,
			clientManifestExists,
			mediaProxy,
			externalMediaProxyEnabled,
			redis,
			redisForPubsub,
			redisForJobQueue,
		};

		return {
			...config,
			url: url.origin,
			...mixin,
		};
	}
}
