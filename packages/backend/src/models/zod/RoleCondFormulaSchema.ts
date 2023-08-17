import { z } from 'zod';
import { defineOpenApiSpec } from 'zod2spec';

const RoleCondFormulaEmpty = defineOpenApiSpec(
	z.record(z.string(), z.never()),
	{ type: 'object', additionalProperties: false },
);

const RoleCondFormulaValueAndSchema_ = z.object({
	type: z.literal('and'),
});

type RoleCondFormulaValueAndSchemaType = z.infer<
	typeof RoleCondFormulaValueAndSchema_
> & {
	values: z.infer<typeof RoleCondFormulaValueSchema>[];
};

const RoleCondFormulaValueAndSchema: z.ZodType<RoleCondFormulaValueAndSchemaType> =
	RoleCondFormulaValueAndSchema_.extend({
		values: z.array(
			defineOpenApiSpec(
				z.lazy(() => RoleCondFormulaValueSchema),
				{ $ref: '#/components/schemas/RoleCondFormulaValue' },
			),
		),
	});

const RoleCondFormulaValueOrSchema_ = z.object({
	type: z.literal('or'),
});

type RoleCondFormulaValueOrSchemaType = z.infer<
	typeof RoleCondFormulaValueOrSchema_
> & {
	values: z.infer<typeof RoleCondFormulaValueSchema>[];
};

const RoleCondFormulaValueOrSchema: z.ZodType<RoleCondFormulaValueOrSchemaType> =
	RoleCondFormulaValueOrSchema_.extend({
		values: z.array(
			defineOpenApiSpec(
				z.lazy(() => RoleCondFormulaValueSchema),
				{ $ref: '#/components/schemas/RoleCondFormulaValue' },
			),
		),
	});

const RoleCondFormulaValueNotSchema_ = z.object({
	type: z.literal('not'),
});

type RoleCondFormulaValueNotSchemaType = z.infer<
	typeof RoleCondFormulaValueNotSchema_
> & {
	value: z.infer<typeof RoleCondFormulaValueSchema>;
};

const RoleCondFormulaValueNotSchema: z.ZodType<RoleCondFormulaValueNotSchemaType> =
	RoleCondFormulaValueNotSchema_.extend({
		value: defineOpenApiSpec(
			z.lazy(() => RoleCondFormulaValueSchema),
			{ $ref: '#/components/schemas/RoleCondFormulaValue' },
		),
	});

const RoleCondFormulaValueIsLocalSchema = z.object({
	type: z.literal('isLocal'),
});

const RoleCondFormulaValueIsRemoteSchema = z.object({
	type: z.literal('isRemote'),
});

const RoleCondFormulaValueCreatedLessThanSchema = z.object({
	type: z.literal('createdLessThan'),
	sec: z.number(),
});

const RoleCondFormulaValueCreatedMoreThanSchema = z.object({
	type: z.literal('createdMoreThan'),
	sec: z.number(),
});

const RoleCondFormulaValueFollowersLessThanOrEqSchema = z.object({
	type: z.literal('followersLessThanOrEq'),
	value: z.number(),
});

const RoleCondFormulaValueFollowersMoreThanOrEqSchema = z.object({
	type: z.literal('followersMoreThanOrEq'),
	value: z.number(),
});

const RoleCondFormulaValueFollowingLessThanOrEqSchema = z.object({
	type: z.literal('followingLessThanOrEq'),
	value: z.number(),
});

const RoleCondFormulaValueFollowingMoreThanOrEqSchema = z.object({
	type: z.literal('followingMoreThanOrEq'),
	value: z.number(),
});

const RoleCondFormulaValueNotesLessThanOrEqSchema = z.object({
	type: z.literal('notesLessThanOrEq'),
	value: z.number(),
});

const RoleCondFormulaValueNotesMoreThanOrEqSchema = z.object({
	type: z.literal('notesMoreThanOrEq'),
	value: z.number(),
});

export const RoleCondFormulaValueSchema = z.union([
	RoleCondFormulaEmpty,
	RoleCondFormulaValueAndSchema,
	RoleCondFormulaValueOrSchema,
	RoleCondFormulaValueNotSchema,
	RoleCondFormulaValueIsLocalSchema,
	RoleCondFormulaValueIsRemoteSchema,
	RoleCondFormulaValueCreatedLessThanSchema,
	RoleCondFormulaValueCreatedMoreThanSchema,
	RoleCondFormulaValueFollowersLessThanOrEqSchema,
	RoleCondFormulaValueFollowersMoreThanOrEqSchema,
	RoleCondFormulaValueFollowingLessThanOrEqSchema,
	RoleCondFormulaValueFollowingMoreThanOrEqSchema,
	RoleCondFormulaValueNotesLessThanOrEqSchema,
	RoleCondFormulaValueNotesMoreThanOrEqSchema,
]);
