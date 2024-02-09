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
		'plugin:@typescript-eslint/strict-type-checked',
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
		// 厳しくしているもの
		'@typescript-eslint/explicit-function-return-type': ['error'],
		'@typescript-eslint/explicit-member-accessibility': ['error', { overrides: { constructors: 'off' } }],
		'@typescript-eslint/naming-convention': ['error', { selector: 'typeLike', format: ['PascalCase'] }, { selector: 'typeParameter', format: [] }],
		'@typescript-eslint/no-inferrable-types': ['error'],
		'@typescript-eslint/prefer-readonly': ['error'],
		// 事情があって無効化しているもの
		'@typescript-eslint/no-extraneous-class': ['off'], // NestJSの`@Module`デコレータを使うようなクラスは中身が空になる
		// TODO
		'@typescript-eslint/await-thenable': ['warn'],
		'@typescript-eslint/no-base-to-string': ['warn'],
		'@typescript-eslint/no-confusing-void-expression': ['warn'],
		'@typescript-eslint/no-dynamic-delete': ['warn'],
		'@typescript-eslint/no-explicit-any': ['warn'],
		'@typescript-eslint/no-floating-promises': ['warn'],
		'@typescript-eslint/no-invalid-void-type': ['warn'],
		'@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
		'@typescript-eslint/no-non-null-assertion': ['warn'],
		'@typescript-eslint/no-throw-literal': ['warn'],
		'@typescript-eslint/no-unnecessary-condition': ['warn'],
		'@typescript-eslint/no-unsafe-argument': ['warn'],
		'@typescript-eslint/no-unsafe-assignment': ['warn'],
		'@typescript-eslint/no-unsafe-call': ['warn'],
		'@typescript-eslint/no-unsafe-member-access': ['warn'],
		'@typescript-eslint/no-unsafe-return': ['warn'],
		'@typescript-eslint/no-unused-vars': ['warn'],
		'@typescript-eslint/prefer-includes': ['warn'],
		'@typescript-eslint/prefer-nullish-coalescing': ['warn'],
		'@typescript-eslint/require-await': ['warn'],
		'@typescript-eslint/restrict-plus-operands': ['warn'],
		'@typescript-eslint/restrict-template-expressions': ['warn'],

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
