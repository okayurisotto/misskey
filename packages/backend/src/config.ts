/**
 * Config loader
 */

import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { pick } from 'omick';
import { MISSKEY_CONFIG_YML, NODE_ENV, PORT } from '@/env.js';
import { idGenerationMethods } from '@/const.js';

const RedisOptionsSourceSchema = z.object({
	host: z.string(),
	port: z.number(),
	family: z.number().default(0),
	pass: z.string().optional(),
	db: z.number().default(0),
	prefix: z.string().optional(),
});

type RedisOptionsSource = z.infer<typeof RedisOptionsSourceSchema>;

/** ユーザーが設定する必要のある情報 */
const SourceSchema = z.object({
	url: z.string().url(),
	port: z.number().default(PORT ?? 3000),
	socket: z.string().optional(),
	allowedPrivateNetworks: z.string().array().default([]),
	chmodSocket: z.string().optional(),
	disableHsts: z.boolean().default(false),
	signToActivityPubGet: z.boolean().default(false),

	id: z.enum(idGenerationMethods),

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
			port: z.string(),
			apiKey: z.string(),
			ssl: z.boolean().default(false),
			index: z.string(),
			scope: z.enum(['local', 'global']).or(z.string().array()),
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
	mediaProxy: z.string().nullable().default(null),
	proxyRemoteFiles: z.boolean().default(false),
	videoThumbnailGenerator: z.string().nullable().default(null),

	repository_url: z.string().optional(), // unused?
	feedback_url: z.string().optional(), // unused?
	accesslog: z.string().optional(), // unused?
	outgoingAddressFamily: z.enum(['ipv4', 'ipv6', 'dual']).optional(), // unused?
});

type Source = z.infer<typeof SourceSchema>;

const MetaSchema = z.object({ version: z.string() });

/** Misskeyが自動的に（ユーザーが設定した情報から推論して）設定する情報 */
type Mixin = {
	version: string;
	host: string;
	hostname: string;
	scheme: string;
	wsScheme: string;
	apiUrl: string;
	wsUrl: string;
	authUrl: string;
	driveUrl: string;
	userAgent: string;
	clientEntry: { file: string; css?: string[] };
	clientManifestExists: boolean;
	mediaProxy: string;
	externalMediaProxyEnabled: boolean;
	videoThumbnailGenerator: string | null;
	redis: RedisOptionsSource;
	redisForPubsub: RedisOptionsSource;
	redisForJobQueue: RedisOptionsSource;
};

export type Config = Source & Mixin;

const ClientManifestSchema = z.record(
	z.string(),
	z.object({
		file: z.string(),
		css: z.string().array().optional(),
	}),
);

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

/** Path of configuration file */
const configPath = ((): string => {
	/** Path of configuration directory */
	const dir = _dirname + '/../../../.config';

	if (MISSKEY_CONFIG_YML !== undefined) {
		return resolve(dir, MISSKEY_CONFIG_YML);
	}

	if (NODE_ENV === 'test') {
		return resolve(dir, 'test.yml');
	}

	return resolve(dir, 'default.yml');
})();
const metaPath = _dirname + '/../../../built/meta.json';
const clientManifestPath = _dirname + '/../../../built/_vite_/manifest.json';

const removeLastSlash = (value: string): string => {
	if (!value.endsWith('/')) return value;
	return value.substring(0, value.length - 1);
};

const convertRedisOptions = (
	options: RedisOptionsSource,
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
} => ({
	...pick(options, ['host', 'pass', 'port', 'family', 'db']),
	keyPrefix: `${options.prefix ?? host}:`,
	password: options.pass,
	prefix: options.prefix ?? host,
});

const tryCreateUrl = (url: string): URL => {
	try {
		return new URL(url);
	} catch {
		throw new Error(`url="${url}" is not a valid URL.`);
	}
};

export const loadConfig = (): Config => {
	const meta = MetaSchema.parse(JSON.parse(fs.readFileSync(metaPath, 'utf-8')));
	const clientManifestExists = fs.existsSync(clientManifestPath);
	const clientManifest = clientManifestExists
		? ClientManifestSchema.parse(
				JSON.parse(fs.readFileSync(clientManifestPath, 'utf-8')),
		  )
		: { 'src/_boot_.ts': { file: 'src/_boot_.ts' } };
	const config = SourceSchema.parse(
		yaml.load(fs.readFileSync(configPath, 'utf-8')),
	);
	const url = tryCreateUrl(config.url);

	const version = meta.version;
	const host = url.host;
	const hostname = url.hostname;
	const scheme = url.protocol.replace(/:$/, '');
	const wsScheme = scheme.replace('http', 'ws');
	const wsUrl = `${wsScheme}://${host}`;
	const apiUrl = `${scheme}://${host}/api`;
	const authUrl = `${scheme}://${host}/auth`;
	const driveUrl = `${scheme}://${host}/files`;
	const userAgent = `Misskey/${meta.version} (${config.url})`;
	const clientEntry = clientManifest['src/_boot_.ts'];

	const externalMediaProxy =
		config.mediaProxy !== null ? removeLastSlash(config.mediaProxy) : null;
	const internalMediaProxy = `${scheme}://${host}/proxy`;
	const mediaProxy = externalMediaProxy ?? internalMediaProxy;
	const externalMediaProxyEnabled =
		externalMediaProxy !== null && externalMediaProxy !== internalMediaProxy;

	const videoThumbnailGenerator =
		config.videoThumbnailGenerator !== null
			? removeLastSlash(config.videoThumbnailGenerator)
			: null;

	const redis = convertRedisOptions(config.redis, host);
	const redisForPubsub =
		config.redisForPubsub !== undefined
			? convertRedisOptions(config.redisForPubsub, host)
			: redis;
	const redisForJobQueue =
		config.redisForJobQueue !== undefined
			? convertRedisOptions(config.redisForJobQueue, host)
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
		videoThumbnailGenerator,
		redis,
		redisForPubsub,
		redisForJobQueue,
	};

	return {
		...config,
		url: url.origin,
		...mixin,
	};
};
