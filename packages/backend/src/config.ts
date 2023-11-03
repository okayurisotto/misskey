/**
 * Config loader
 */

import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { pick } from 'omick';

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
	repository_url: z.string().optional(),
	feedback_url: z.string().optional(),
	url: z.string(),
	port: z.number().default(parseInt(process.env['PORT'] ?? '', 10)),
	socket: z.string().optional(),
	chmodSocket: z.string().optional(),
	disableHsts: z.boolean().optional(),

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
			ssl: z.boolean().optional(),
			index: z.string(),
			scope: z.enum(['local', 'global']).or(z.string().array()),
		})
		.optional(),

	proxy: z.string().optional(),
	proxySmtp: z.string().optional(),
	proxyBypassHosts: z.string().array().optional(),

	allowedPrivateNetworks: z.string().array().optional(),

	maxFileSize: z.number().optional(),

	accesslog: z.string().optional(),

	clusterLimit: z.number().default(1),

	id: z.string(),

	outgoingAddressFamily: z.enum(['ipv4', 'ipv6', 'dual']).optional(),

	deliverJobConcurrency: z.number().optional(),
	inboxJobConcurrency: z.number().optional(),
	relashionshipJobConcurrency: z.number().optional(),
	deliverJobPerSec: z.number().optional(),
	inboxJobPerSec: z.number().optional(),
	relashionshipJobPerSec: z.number().optional(),
	deliverJobMaxAttempts: z.number().optional(),
	inboxJobMaxAttempts: z.number().optional(),

	mediaProxy: z.string().nullable().default(null),
	proxyRemoteFiles: z.boolean().optional(),
	videoThumbnailGenerator: z.string().nullable().default(null),

	signToActivityPubGet: z.boolean().optional(),
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
	clientEntry: string;
	clientManifestExists: boolean;
	mediaProxy: string;
	externalMediaProxyEnabled: boolean;
	videoThumbnailGenerator: string | null;
	redis: RedisOptionsSource;
	redisForPubsub: RedisOptionsSource;
	redisForJobQueue: RedisOptionsSource;
};

export type Config = Source & Mixin;

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

/** Path of configuration file */
const configPath = ((): string => {
	/** Path of configuration directory */
	const dir = _dirname + '/../../../.config';

	if (process.env['MISSKEY_CONFIG_YML']) {
		return resolve(dir, process.env['MISSKEY_CONFIG_YML']);
	}

	if (process.env['NODE_ENV'] === 'test') {
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
		? JSON.parse(fs.readFileSync(clientManifestPath, 'utf-8'))
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
