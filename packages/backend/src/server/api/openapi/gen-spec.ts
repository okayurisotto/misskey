import { generateOpenApiSpec as generateOpenApiSpec_ } from 'zod2spec';
import type { Config } from '@/config.js';
import endpoints from '../endpoints.js';
import { errors as basicErrors } from './errors.js';
import { models } from './models.js';

const generateOpenApiSpec = generateOpenApiSpec_(models);

type OpenApiSpec = {
	openapi: string;
	info: {
		version: string;
		title: string;
		'x-logo': { url: string };
	};
	externalDocs: { description: string; url: string };
	servers: { url: string }[];
	paths: Record<string, unknown>;
	components: {
		schemas: {
			Error: {
				type: string;
				properties: {
					error: {
						type: string;
						description: string;
						properties: {
							code: { type: string; description: string };
							message: { type: string; description: string };
							id: { type: string; format: string; description: string };
						};
						required: string[];
					};
				};
				required: string[];
			};
		};
		securitySchemes: { ApiKeyAuth: { type: string; in: string; name: string } };
	};
};

export function generateFullOpenApiSpec(config: Config): OpenApiSpec {
	const spec = {
		openapi: '3.0.0',
		info: {
			version: config.version,
			title: 'Misskey API',
			'x-logo': { url: '/static-assets/api-doc.png' },
		},
		externalDocs: {
			description: 'Repository',
			url: 'https://github.com/misskey-dev/misskey',
		},
		servers: [{ url: config.apiUrl }],
		paths: {} as Record<string, unknown>,
		components: {
			schemas: {
				Error: {
					type: 'object',
					properties: {
						error: {
							type: 'object',
							description: 'An error object.',
							properties: {
								code: {
									type: 'string',
									description: 'An error code. Unique within the endpoint.',
								},
								message: {
									type: 'string',
									description: 'An error message.',
								},
								id: {
									type: 'string',
									format: 'uuid',
									description: 'An error ID. This ID is static.',
								},
							},
							required: ['code', 'id', 'message'],
						},
					},
					required: ['error'],
				},
				...Object.fromEntries(
					models.map(({ key, schema }) => [
						key,
						generateOpenApiSpec_(
							models.filter((model) => model.schema !== schema),
						)(schema),
					]),
				),
			},
			securitySchemes: {
				ApiKeyAuth: { type: 'apiKey', in: 'body', name: 'i' },
			},
		},
	};

	for (const endpoint of endpoints.filter((ep) => !ep.meta.secure)) {
		const errors = {} as Record<string, { value: unknown }>;

		if (endpoint.meta.errors) {
			for (const e of Object.values(endpoint.meta.errors)) {
				errors[e.code] = {
					value: {
						error: e,
					},
				};
			}
		}

		const resSpec =
			endpoint.meta.res !== undefined
				? generateOpenApiSpec(endpoint.meta.res)
				: {};

		let desc =
			(endpoint.meta.description ?? 'No description provided.') + '\n\n';
		desc += `**Credential required**: *${
			endpoint.meta.requireCredential ? 'Yes' : 'No'
		}*`;
		if (endpoint.meta.kind) {
			const kind = endpoint.meta.kind;
			desc += ` / **Permission**: *${kind}*`;
		}

		const requestType = endpoint.meta.requireFile
			? 'multipart/form-data'
			: 'application/json';
		let reqSpec = generateOpenApiSpec(endpoint.params);

		if (endpoint.meta.requireFile) {
			reqSpec = {
				...reqSpec,
				properties: {
					...('properties' in reqSpec ? reqSpec.properties : {}),
					file: {
						type: 'string',
						format: 'binary',
						description: 'The file contents.',
					},
				},
				required: [
					...('required' in reqSpec ? reqSpec.required ?? [] : []),
					'file',
				],
			};
		}

		const info = {
			operationId: endpoint.name,
			summary: endpoint.name,
			description: desc,
			externalDocs: {
				description: 'Source code',
				url: `https://github.com/misskey-dev/misskey/blob/develop/packages/backend/src/server/api/endpoints/${endpoint.name}.ts`,
			},
			...(endpoint.meta.tags ? { tags: [endpoint.meta.tags[0]] } : {}),
			...(endpoint.meta.requireCredential
				? { security: [{ ApiKeyAuth: [] }] }
				: {}),
			requestBody: {
				required: true,
				content: {
					[requestType]: {
						schema: reqSpec,
					},
				},
			},
			responses: {
				...(endpoint.meta.res
					? {
							'200': {
								description: 'OK (with results)',
								content: { 'application/json': { schema: resSpec } },
							},
					  }
					: { '204': { description: 'OK (without any results)' } }),
				'400': {
					description: 'Client error',
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Error' },
							examples: { ...errors, ...basicErrors['400'] },
						},
					},
				},
				'401': {
					description: 'Authentication error',
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Error' },
							examples: basicErrors['401'],
						},
					},
				},
				'403': {
					description: 'Forbidden error',
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Error' },
							examples: basicErrors['403'],
						},
					},
				},
				'418': {
					description: "I'm Ai",
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Error' },
							examples: basicErrors['418'],
						},
					},
				},
				...(endpoint.meta.limit
					? {
							'429': {
								description: 'To many requests',
								content: {
									'application/json': {
										schema: { $ref: '#/components/schemas/Error' },
										examples: basicErrors['429'],
									},
								},
							},
					  }
					: {}),
				'500': {
					description: 'Internal server error',
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/Error' },
							examples: basicErrors['500'],
						},
					},
				},
			},
		};

		spec.paths['/' + endpoint.name] = {
			post: info,
		};
	}

	return spec;
}
