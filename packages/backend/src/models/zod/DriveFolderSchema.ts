import { z } from 'zod';
import { misskeyIdPattern } from './misc.js';

const DriveFolderSchemaBase = z.object({
	id: misskeyIdPattern,
	createdAt: z.string().datetime(),
	name: z.string(),
	foldersCount: z.number().optional(),
	filesCount: z.number().optional(),
	parentId: misskeyIdPattern.nullable(),
	// parent: DriveFolderSchema.nullable().optional(),
});

type DriveFolderType = z.infer<typeof DriveFolderSchemaBase> & {
	parent?: DriveFolderType | null;
};

export const DriveFolderSchema: z.ZodType<DriveFolderType> =
	DriveFolderSchemaBase.extend({
		parent: z.lazy(() => DriveFolderSchema.nullable()).optional(),
	});
