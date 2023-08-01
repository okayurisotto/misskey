import { z } from 'zod';
import { defineOpenApiSpec } from 'zod2spec';
import { MisskeyIdSchema } from './misc.js';

const DriveFolderSchemaBase = z.object({
	id: MisskeyIdSchema,
	createdAt: z.string().datetime(),
	name: z.string(),
	foldersCount: z.number().optional(),
	filesCount: z.number().optional(),
	parentId: MisskeyIdSchema.nullable(),
	// parent: DriveFolderSchema.nullable().optional(),
});

type DriveFolderType = z.infer<typeof DriveFolderSchemaBase> & {
	parent?: DriveFolderType | null;
};

export const DriveFolderSchema: z.ZodType<DriveFolderType> =
	DriveFolderSchemaBase.extend({
		parent: defineOpenApiSpec(
			z.lazy(() => DriveFolderSchema.nullable()),
			{ $ref: '#/components/schemas/DriveFolder' },
		).optional(),
	});
