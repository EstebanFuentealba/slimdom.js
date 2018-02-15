import * as fs from 'fs';
import * as parse5 from 'parse5';
import * as path from 'path';

import * as slimdom from '../../src/index';

import SlimdomTreeAdapter from './SlimdomTreeAdapter';

import TEST_BLACKLIST from './blacklist';

function getNodes(root: slimdom.Node, ...path: string[]): slimdom.Node[] {
	if (!path.length) {
		return [root];
	}

	const [nodeName, ...remainder] = path;
	const matchingChildren = Array.from((root as slimdom.Element).childNodes).filter(
		n => n.nodeName === nodeName
	);
	return matchingChildren.reduce(
		(nodes, child) => nodes.concat(getNodes(child, ...remainder)),
		[] as slimdom.Node[]
	);
}

function getAllText(root: slimdom.Node, ...path: string[]): string {
	return getNodes(root, ...path)
		.map(n => (n as slimdom.Text).data)
		.join('');
}

function getAllScripts(doc: slimdom.Document, casePath: string) {
	const scriptElements = (doc as any).getElementsByTagName('script');
	return scriptElements
		.reduce((scripts: string[], el: slimdom.Element) => {
			const src = el.attributes.find(a => a.name === 'src');
			if (src) {
				let resolvedPath: string;
				if (src.value === '/resources/WebIDLParser.js') {
					// Historical alias, unfortunately not an actual file
					// https://github.com/w3c/web-platform-tests/issues/5608
					resolvedPath = path.resolve(
						process.env.WEB_PLATFORM_TESTS_PATH as string,
						'resources/webidl2/lib/webidl2.js'
					);
				} else {
					resolvedPath = src.value.startsWith('/')
						? path.resolve(process.env.WEB_PLATFORM_TESTS_PATH as string, src.value.substring(1))
						: path.resolve(path.dirname(casePath), src.value);
				}
				return scripts.concat([fs.readFileSync(resolvedPath, 'utf-8')]);
			}

			return scripts.concat([getAllText(el, '#text')]);
		}, [])
		.join('\n');
}

function createTest(casePath: string, blacklistReason: { [key: string]: string } = {}): void {
	const document = parse5.parse(fs.readFileSync(casePath, 'utf-8'), {
		treeAdapter: new SlimdomTreeAdapter()
	}) as slimdom.Document;
	const title = getAllText(document, 'html', 'head', 'title', '#text') || path.basename(casePath);
	const script = getAllScripts(document, casePath);
	const scriptAsFunction = new Function(
		'stubEnvironment',
		`with (stubEnvironment) { ${script} }`
	);
	let stubs: { global: any; onLoadCallbacks: Function[]; onErrorCallback?: Function };

	const { document: _, ...domInterfaces } = slimdom;

	function createStubEnvironment(
		document: slimdom.Document
	): { global: any; onLoadCallbacks: Function[]; onErrorCallback?: Function } {
		const onLoadCallbacks: Function[] = [];
		let onErrorCallback: Function | undefined = undefined;
		let global: any = {
			document,
			location: { href: casePath },
			window: null,

			get frames() {
				return (document as any).getElementsByTagName('iframe').map((iframe: any) => {
					if (!iframe.contentWindow) {
						const stubs = createStubEnvironment(
							document.implementation.createHTMLDocument()
						);
						iframe.contentWindow = stubs.global.window;
						iframe.contentDocument = stubs.global.document;
						iframe.document = stubs.global.document;
					}

					return iframe;
				});
			},

			addEventListener(event: string, cb: Function) {
				switch (event) {
					case 'load':
						onLoadCallbacks.push(cb);
						break;

					case 'error':
						onErrorCallback = cb;
						break;

					default:
				}
			},

			...domInterfaces
		};
		global.window = global;
		global.parent = global;
		global.self = global;

		return { global, onLoadCallbacks, onErrorCallback };
	}

	beforeEach(() => {
		stubs = createStubEnvironment(document);
	});

	it(title, (done: Function) => {
		try {
			scriptAsFunction(stubs.global);

			if (!stubs.global.add_completion_callback) {
				// No test harness found, assume file is not really a test case
				done();
				return;
			}

			stubs.global.add_completion_callback(function(tests: any[], testStatus: any) {
				// TODO: Seems to be triggered by duplicate names in the createDocument tests
				//expect(testStatus.status).toBe(testStatus.OK);
				tests.forEach(test => {
					// Ignore results of blacklisted tests
					if (!blacklistReason[test.name]) {
						if (test.status !== testStatus.OK) {
							console.log(`${test.name}: ${test.message}`);
						}
						expect(test.status).toBe(testStatus.OK);
					}
				});
				done();
			});

			stubs.onLoadCallbacks.forEach(cb => cb({}));

			// "Run" iframes
			(stubs.global.frames as any[]).forEach(iframe => {
				if (iframe.onload) {
					iframe.onload();
				}
			});
		} catch (e) {
			if (stubs.onErrorCallback) {
				stubs.onErrorCallback(e);
			} else {
				throw e;
			}
		}
	});
}

function createTests(dirPath: string): void {
	fs.readdirSync(dirPath).forEach(entry => {
		const entryPath = path.join(dirPath, entry);
		const relativePath = path.relative(process.env.WEB_PLATFORM_TESTS_PATH as string, entryPath);
		const blacklistReason = TEST_BLACKLIST[relativePath.replace(/\\/g, '/')];
		if (typeof blacklistReason === 'string') {
			// Create a pending test
			it(`${entry}: ${blacklistReason}`);
			return;
		}

		if (fs.statSync(entryPath).isDirectory()) {
			describe(entry, () => {
				createTests(entryPath);
			});
			return;
		}

		if (entry.endsWith('.html')) {
			createTest(entryPath, blacklistReason);
		}
	});
}

describe('web platform DOM test suite', () => {
	if (!process.env.WEB_PLATFORM_TESTS_PATH) {
		it('requires the WEB_PLATFORM_TESTS_PATH environment variable to be set');
		return;
	}

	// Some web platform tests are a bit slow
	// TODO: change to jest.setTimeout(20000); when jest 21 is released
	jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

	(slimdom.Document.prototype as any).getElementsByTagName = function(
		this: slimdom.Document,
		tagName: string
	): slimdom.Node[] {
		return (function getElementsByTagName(node: slimdom.Node): slimdom.Node[] {
			return node.childNodes.reduce(
				(elements, child) => {
					if (child.nodeName === tagName) {
						elements.push(child);
					}

					if (child.nodeType === slimdom.Node.ELEMENT_NODE) {
						elements = elements.concat(getElementsByTagName(child));
					}

					return elements;
				},
				[] as slimdom.Node[]
			);
		})(this);
	};

	(slimdom.Document.prototype as any).getElementById = function getElementById(
		this: slimdom.Node,
		id: string
	): slimdom.Node | null {
		return (function getElementById(node: slimdom.Node): slimdom.Node | null {
			for (let child = node.firstChild; child; child = child.nextSibling) {
				if (
					child.nodeType === slimdom.Node.ELEMENT_NODE &&
					(child as slimdom.Element).getAttribute('id') === id
				) {
					return child;
				}
				const descendant = getElementById(child);
				if (descendant) {
					return descendant;
				}
			}

			return null;
		})(this);
	};

	// Stub not implemented properties to prevent createDocument tests from failing on these
	Object.defineProperties(slimdom.Document.prototype, {
		URL: {
			value: 'about:blank'
		},
		documentURI: {
			value: 'about:blank'
		},
		compatMode: {
			value: 'CSS1Compat'
		},
		characterSet: {
			value: 'UTF-8'
		},
		charset: {
			value: 'UTF-8'
		},
		inputEncoding: {
			value: 'UTF-8'
		},
		contentType: {
			value: 'application/xml'
		},
		origin: {
			value: 'null'
		},
		body: {
			get() {
				return this.getElementsByTagName('body')[0] || null;
			}
		},
		title: {
			get() {
				return getAllText(this, 'html', 'head', 'title', '#text');
			}
		}
	});

	(slimdom.Document.prototype as any).querySelectorAll = () => [];
	(slimdom.Document.prototype as any).querySelector = () => null;

	Object.defineProperties(slimdom.Attr.prototype, {
		specified: {
			value: true
		},
		textContent: {
			get() {
				return this.nodeValue;
			}
		}
	});
	Object.defineProperties(slimdom.CharacterData.prototype, {
		textContent: {
			get() {
				return this.nodeValue;
			}
		}
	});
	Object.defineProperties(slimdom.Element.prototype, {
		style: {
			value: {}
		}
	});

	createTests(path.join(process.env.WEB_PLATFORM_TESTS_PATH as string, 'dom'));
});
