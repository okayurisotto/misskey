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
		'no-async-promise-executor': ['off'],
		'no-constant-condition': ['warn'],
		'no-control-regex': ['warn'],
		'no-empty-pattern': ['warn'],
		'no-inner-declarations': ['off'],
		'no-sparse-arrays': ['off'],

		/* Suggestions */
		eqeqeq: ['error', 'always', { null: 'ignore' }],
		'no-empty': ['warn'],
		'no-param-reassign': ['warn'],
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
		'no-useless-escape': ['off'],
		'no-var': ['error'],
		'prefer-arrow-callback': ['error'],

		/*  Layout & Formatting */
		// 'array-bracket-spacing': ['error', 'never'],
		// 'arrow-spacing': ['error', { before: true, after: true }],
		// 'comma-dangle': ['warn', 'always-multiline'],
		// 'comma-spacing': ['error', { before: false, after: true }],
		// 'eol-last': ['error', 'always'],
		// indent: [
		// 	'warn',
		// 	'tab',
		// 	{
		// 		SwitchCase: 1,
		// 		MemberExpression: 1,
		// 		flatTernaryExpressions: true,
		// 		ArrayExpression: 'first',
		// 		ObjectExpression: 'first',
		// 	},
		// ],
		// 'key-spacing': ['error', { beforeColon: false, afterColon: true }],
		// 'keyword-spacing': ['error', { before: true, after: true }],
		// 'no-multi-spaces': ['error'],
		// 'no-multiple-empty-lines': ['error', { max: 1 }],
		// 'nonblock-statement-body-position': ['error', 'beside'],
		// 'object-curly-spacing': ['error', 'always'],
		// 'padded-blocks': ['error', 'never'],
		// quotes: ['warn', 'single'],
		// semi: ['error', 'always'],
		// 'semi-spacing': ['error', { before: false, after: true }],
		// 'space-before-blocks': ['error', 'always'],
		// 'space-infix-ops': ['error'],

		/* typescript */
		'@typescript-eslint/consistent-type-imports': 'off',
		'@typescript-eslint/explicit-function-return-type': ['warn'],
		'@typescript-eslint/naming-convention': [
			'error',
			{ selector: 'typeLike', format: ['PascalCase'] },
			{ selector: 'typeParameter', format: [] },
		],
		'@typescript-eslint/no-empty-function': ['off'],
		'@typescript-eslint/no-inferrable-types': ['warn'],
		'@typescript-eslint/no-misused-promises': [
			'error',
			{ checksVoidReturn: false },
		],
		'@typescript-eslint/no-non-null-assertion': ['warn'],
		'@typescript-eslint/no-unnecessary-condition': ['warn'],
		'@typescript-eslint/no-var-requires': ['warn'],
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
