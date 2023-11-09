/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('jest').Config} */
module.exports = {
	// Coverage
	collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts'],
	coverageDirectory: 'coverage',
	coverageProvider: 'v8',

	moduleNameMapper: {
		// Do not resolve .wasm.js to .wasm by the rule below
		'^(.+)\\.wasm\\.js$': '$1.wasm.js',

		// SWC converts @/foo/bar.js to `../../src/foo/bar.js`, and then this rule
		// converts it again to `../../src/foo/bar` which then can be resolved to
		// `.ts` files.
		// See https://github.com/swc-project/jest/issues/64#issuecomment-1029753225
		// TODO: Use `--allowImportingTsExtensions` on TypeScript 5.0 so that we can
		// directly import `.ts` files without this hack.
		'^((?:\\.{1,2}|[A-Z:])*/.*)\\.js$': '$1',
	},

	// Automatically restore mock state between every test
	restoreMocks: true,

	// The glob patterns Jest uses to detect test files
	testMatch: [
		'<rootDir>/test/unit/**/*.ts',
		'<rootDir>/src/**/*.test.ts',
		'<rootDir>/test/e2e/**/*.ts',
	],

	// https://swc.rs/docs/usage/jest
	transform: {
		'^.+\\.(t|j)sx?$': ['@swc/jest'],
	},

	extensionsToTreatAsEsm: ['.ts'],

	testTimeout: 60000,

	// Let Jest kill the test worker whenever it grows too much
	// (It seems there's a known memory leak issue in Node.js' vm.Script used by Jest)
	// https://github.com/facebook/jest/issues/11956
	maxWorkers: 1, // Make it use worker (that can be killed and restarted)
	logHeapUsage: true, // To debug when out-of-memory happens on CI
	workerIdleMemoryLimit: '1GiB', // Limit the worker to 1GB (GitHub Workflows dies at 2GB)
};
