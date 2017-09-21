export default function convertHtmlToTestSuite(src: string, filename: string) {
	return `
describe('${filename.replace(/\\/g, '/')}', () => {
	it('needs to be converted to a test suite');
});
`;
}
