module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	parserOptions: {
		tsconfigRootDir: __dirname,
		project: ['./tsconfig.json', './test/tsconfig.json'],
	},
	plugins: ['@typescript-eslint', 'import'],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended-type-checked',
		'plugin:import/recommended',
		'plugin:import/typescript',
		'prettier',
	],
	rules: {
		/* Possible Problems */
		'no-constant-condition': ['error', { checkLoops: false }],

		/* Suggestions */
		eqeqeq: ['error', 'always', { null: 'ignore' }],
		'no-param-reassign': ['warn'], // TODO
		'no-restricted-globals': [
			'error',
			{
				name: '__dirname',
				message: 'Not in ESModule. Use `import.meta.url` instead.',
			},
			{
				name: '__filename',
				message: 'Not in ESModule. Use `import.meta.url` instead.',
			},
		],
		'no-throw-literal': ['error'],
		'no-var': ['error'],
		'prefer-arrow-callback': ['error'],

		/* typescript */
		'@typescript-eslint/await-thenable': ['warn'], // TODO
		'@typescript-eslint/consistent-type-imports': ['off'], // TODO: デコレータのメタデータとして参照される型を通常の`import`に置き換えなければならなくなり、結果として動かなくなることがあるため
		'@typescript-eslint/explicit-function-return-type': ['error'],
		'@typescript-eslint/naming-convention': ['error', { selector: 'typeLike', format: ['PascalCase'] }, { selector: 'typeParameter', format: [] }],
		'@typescript-eslint/no-base-to-string': ['warn'], // TODO
		'@typescript-eslint/no-empty-function': ['off'], // OK
		'@typescript-eslint/no-explicit-any': ['warn'], // TODO
		'@typescript-eslint/no-floating-promises': ['warn'], // TODO
		'@typescript-eslint/no-inferrable-types': ['error'],
		'@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
		'@typescript-eslint/no-non-null-assertion': ['warn'], // TODO
		'@typescript-eslint/no-redundant-type-constituents': ['warn'], // TODO
		'@typescript-eslint/no-unnecessary-condition': ['warn'], // TODO: 既存の型が`as`などされていて信用できないため
		'@typescript-eslint/no-unsafe-argument': ['warn'], // TODO
		'@typescript-eslint/no-unsafe-assignment': ['warn'], // TODO
		'@typescript-eslint/no-unsafe-call': ['warn'], // TODO
		'@typescript-eslint/no-unsafe-member-access': ['warn'], // TODO
		'@typescript-eslint/no-unsafe-return': ['warn'], // TODO
		'@typescript-eslint/no-unused-vars': ['warn'], // TODO
		'@typescript-eslint/no-var-requires': ['error'],
		'@typescript-eslint/prefer-nullish-coalescing': ['warn'],
		'@typescript-eslint/prefer-readonly': ['error'],
		'@typescript-eslint/require-await': ['warn'], // TODO
		'@typescript-eslint/restrict-plus-operands': ['warn'], // TODO
		'@typescript-eslint/restrict-template-expressions': ['warn'], // TODO
		'@typescript-eslint/unbound-method': ['warn'], // TODO

		/* import */
		'import/no-default-export': ['warn'],
		'import/no-unresolved': ['off'],
		'import/order': [
			'warn',
			{
				groups: [
					'builtin',
					'external',
					'internal',
					'parent',
					'sibling',
					'index',
					'object',
					'type',
				],
				pathGroups: [
					{
						pattern: '@/**',
						group: 'external',
						position: 'after',
					},
				],
			},
		],
	},
};
