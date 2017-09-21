const path = require('path');

const roots = ['<rootDir>/test'];
if (process.env.WEB_PLATFORM_TESTS_PATH) {
	roots.push(path.resolve(process.env.WEB_PLATFORM_TESTS_PATH, 'dom'));
}

module.exports = {
	rootDir: __dirname,
	roots: roots,
	transform: {
		'^.+\\.tsx?$': '<rootDir>/node_modules/ts-jest/preprocessor.js',
		'^.+\\.x?html$': '<rootDir>/test/web-platform-tests/preprocessor.js'
	},
	testRegex: '\\.x?html|test/.*(\\.tests\\.ts)$',
	moduleFileExtensions: ['html', 'xhtml', 'ts', 'tsx', 'js', 'json', 'jsx'],
	collectCoverageFrom: ['src/**/*.ts'],
	mapCoverage: true
};
