import * as slimdom from '../../src/index';

// Some web platform tests are a bit slow
// TODO: change to jest.setTimeout(20000); when jest 21 is released
jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

// TODO: remove these after implementing the features in a fully compliant way
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
			return this.getElementsByTagName('title')[0]
				.childNodes.map((child: slimdom.Node) => {
					if (
						child.nodeType === slimdom.Node.TEXT_NODE ||
						child.nodeType === slimdom.Node.CDATA_SECTION_NODE
					) {
						return (child as slimdom.Text).data;
					}
					return '';
				})
				.join('');
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
Object.defineProperties(slimdom.Element.prototype, { style: { value: {} } });

export default class FakeBrowser {
	private _src: string;
	private _filename: string;

	constructor(src: string, filename: string) {
		this._src = src;
		this._filename = filename;
	}
}
