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
		'plugin:@typescript-eslint/recommended',
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
		'@typescript-eslint/consistent-type-imports': ['off'], // TODO: デコレータのメタデータとして参照される型を通常の`import`に置き換えなければならなくなり、結果として動かなくなることがあるため
		'@typescript-eslint/explicit-function-return-type': ['error'],
		'@typescript-eslint/naming-convention': [
			'error',
			{ selector: 'typeLike', format: ['PascalCase'] },
			{ selector: 'typeParameter', format: [] },
		],
		'@typescript-eslint/no-empty-function': ['off'], // OK
		'@typescript-eslint/no-inferrable-types': ['error'],
		'@typescript-eslint/no-misused-promises': [
			'error',
			{ checksVoidReturn: false },
		],
		'@typescript-eslint/no-non-null-assertion': ['warn'], // TODO
		'@typescript-eslint/no-unnecessary-condition': ['warn'], // TODO: 既存の型が`as`などされていて信用できないため
		'@typescript-eslint/no-var-requires': ['error'],
		'@typescript-eslint/prefer-nullish-coalescing': ['error'],

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
