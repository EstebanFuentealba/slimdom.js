import * as path from 'path';

import blacklist from './blacklist';

export default function convertHtmlToTestSuite(src: string, filename: string) {
	const testSrc = [`describe(${JSON.stringify(filename.replace(/\\/g, '/'))}, () => {`];

	const relativePath = path.relative(process.env.WEB_PLATFORM_TESTS_PATH, filename);
	const normalizedRelativePath = relativePath.replace(/\\/g, '/');
	const blacklistReason = blacklist[normalizedRelativePath];
	if (typeof blacklistReason === 'string') {
		testSrc.push(`it(${JSON.stringify(blacklistReason)});`);
	} else {
		testSrc.push(`it('needs to be preprocessed');`);
	}

	testSrc.push('});');

	return testSrc.join('\n');
}
