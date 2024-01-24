"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const xml_1 = __importDefault(require("xml"));
const nconf_1 = __importDefault(require("nconf"));
const plugins_1 = __importDefault(require("../plugins"));
const meta_1 = __importDefault(require("../meta"));
function trimToLength(string, length) {
    return string.trim().substring(0, length).trim();
}
function generateXML() {
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
        @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
    return (0, xml_1.default)([{
            OpenSearchDescription: [
                {
                    _attr: {
                        xmlns: 'http://a9.com/-/spec/opensearch/1.1/',
                        'xmlns:moz': 'http://www.mozilla.org/2006/browser/search/',
                    },
                },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                { ShortName: trimToLength(String(meta_1.default.config.title || meta_1.default.config.browserTitle || 'NodeBB'), 16) },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                { Description: trimToLength(String(meta_1.default.config.description || ''), 1024) },
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
                        /* eslint-disable-next-line @typescript-eslint/restrict-template-expressions */
                        `${nconf_1.default.get('url')}/favicon.ico`,
                    ],
                },
                {
                    Url: {
                        _attr: {
                            type: 'text/html',
                            method: 'get',
                            /* eslint-disable-next-line @typescript-eslint/restrict-template-expressions */
                            template: `${nconf_1.default.get('url')}/search?term={searchTerms}&in=titlesposts`,
                        },
                    },
                },
                /* eslint-disable-next-line @typescript-eslint/restrict-template-expressions */
                { 'moz:SearchForm': `${nconf_1.default.get('url')}/search` },
            ],
        }], { declaration: true, indent: '\t' });
}
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
function handle(req, res, next) {
    if (plugins_1.default.hooks.hasListeners('filter:search.query')) {
        res.type('application/opensearchdescription+xml').send(generateXML());
    }
    else {
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
        @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
        next();
    }
}
exports.default = handle;
