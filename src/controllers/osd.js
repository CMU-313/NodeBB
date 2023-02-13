"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = void 0;
const xml_1 = __importDefault(require("xml"));
const nconf_1 = __importDefault(require("nconf"));
const plugins_1 = __importDefault(require("../plugins"));
const meta_1 = __importDefault(require("../meta"));
function trimToLength(string, length) {
    return string.trim().substring(0, length).trim();
}
function generateXML() {
    const x = (0, xml_1.default)([{
            OpenSearchDescription: [
                {
                    _attr: {
                        xmlns: 'http://a9.com/-/spec/opensearch/1.1/',
                        'xmlns:moz': 'http://www.mozilla.org/2006/browser/search/',
                    },
                },
                { ShortName: trimToLength(String(meta_1.default.configs.title || meta_1.default.configs.browserTitle || 'NodeBB'), 16) },
                { Description: trimToLength(String(meta_1.default.configs.description || ''), 1024) },
                { InputEncoding: 'UTF-8' },
                {
                    Image: [
                        {
                            _attr: {
                                width: '16',
                                height: '16',
                                type: 'image/x-icon',
                            },
                        },
                        `${(nconf_1.default.get('url'))}/favicon.ico`,
                    ],
                },
                {
                    Url: {
                        _attr: {
                            type: 'text/html',
                            method: 'get',
                            template: `${(nconf_1.default.get('url'))}/search?term={searchTerms}&in=titlesposts`,
                        },
                    },
                },
                { 'moz:SearchForm': `${(nconf_1.default.get('url'))}/search` },
            ],
        }], { declaration: true, indent: '\t' });
    return x;
}
// eslint-disable-next-line import/prefer-default-export
function handle(req, res, next) {
    console.log('osd handl called');
    if (plugins_1.default.hooks.hasListeners('filter:search.query')) {
        console.log('if statement');
        console.log(generateXML());
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        res.type('application/opensearchdescription+xml').send(generateXML());
    }
    else {
        console.log('else');
        next();
    }
}
exports.handle = handle;
