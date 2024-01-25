"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const nconf = require("nconf");
const url = require("url");
const winston = require("winston");
const sanitize = require("sanitize-html");
const _ = require("lodash");
const meta = require("../meta");
const plugins = require("../plugins");
const translator = require("../translator");
const utils = require("../utils");
const cache = require("../cache");
let sanitizeConfig = {};
sanitizeConfig.allowedTags = sanitize.defaults.allowedTags.concat([
    // Some safe-to-use tags to add
    'sup', 'ins', 'del', 'img', 'button',
    'video', 'audio', 'iframe', 'embed',
    // 'sup' still necessary until https://github.com/apostrophecms/sanitize-html/pull/422 merged
]);
sanitizeConfig.allowedAttributes = Object.assign(Object.assign({}, sanitize.defaults.allowedAttributes), { a: ['href', 'name', 'hreflang', 'media', 'rel', 'target', 'type'], img: ['alt', 'height', 'ismap', 'src', 'usemap', 'width', 'srcset'], iframe: ['height', 'name', 'src', 'width'], video: ['autoplay', 'controls', 'height', 'loop', 'muted', 'poster', 'preload', 'src', 'width'], audio: ['autoplay', 'controls', 'loop', 'muted', 'preload', 'src'], embed: ['height', 'src', 'type', 'width'] });
sanitizeConfig.globalAttributes = ['accesskey', 'class', 'contenteditable', 'dir',
    'draggable', 'dropzone', 'hidden', 'id', 'lang', 'spellcheck', 'style',
    'tabindex', 'title', 'translate', 'aria-expanded', 'data-*',
];
function ParsePosts(Posts) {
    function sanitizeSignature(signature) {
        signature = translator.escape(signature);
        const tagsToStrip = [];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (meta.config['signatures:disableLinks']) {
            tagsToStrip.push('a');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (meta.config['signatures:disableImages']) {
            tagsToStrip.push('img');
        }
        return utils.stripHTMLTags(signature, tagsToStrip);
    }
    Posts.urlRegex = {
        regex: /href="([^"]+)"/g,
        length: 6,
    };
    Posts.imgRegex = {
        regex: /src="([^"]+)"/g,
        length: 5,
    };
    Posts.parsePost = function (postData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!postData) {
                return postData;
            }
            postData.content = String(postData.content || '');
            const pid = String(postData.pid);
            const cachedContent = cache.get(pid);
            if (postData.pid && cachedContent !== undefined) {
                postData.content = cachedContent;
                return postData;
            }
            const data = yield plugins.hooks.fire('filter:parse.post', { postData: postData });
            data.postData.content = translator.escape(data.postData.content);
            if (data.postData.pid) {
                cache.set(pid, data.postData.content);
            }
            return data.postData;
        });
    };
    Posts.parseSignature = function (userData, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            userData.signature = sanitizeSignature(userData.signature || '');
            return yield plugins.hooks.fire('filter:parse.signature', { userData: userData, uid: uid });
        });
    };
    Posts.relativeToAbsolute = function (content, regex) {
        // Turns relative links in content to absolute urls
        if (!content) {
            return content;
        }
        let parsed;
        let current = regex.regex.exec(content);
        let absolute;
        while (current !== null) {
            if (current[1]) {
                try {
                    parsed = url.parse(current[1]);
                    if (!parsed.protocol) {
                        if (current[1].startsWith('/')) {
                            // Internal link
                            const base_url = nconf.get('base_url');
                            absolute = base_url + current[1].toString();
                        }
                        else {
                            // External link
                            absolute = `//${current[1]}`;
                        }
                        content = content.slice(0, current.index + regex.length) +
                            absolute +
                            content.slice(current.index + regex.length + current[1].length);
                    }
                }
                catch (err) {
                    // found solution to error typing here: https://stackoverflow.com/questions/69021040/why-catch-clause-variable-type-annotation-must-be-any
                    if (err instanceof Error) {
                        winston.verbose(err.message);
                    }
                }
            }
            current = regex.regex.exec(content);
        }
        return content;
    };
    Posts.sanitize = function (content) {
        return sanitize(content, {
            allowedTags: sanitizeConfig.allowedTags,
            allowedAttributes: sanitizeConfig.allowedAttributes,
            // allowedClasses: sanitizeConfig.allowedClasses,
        });
    };
    Posts.configureSanitize = () => __awaiter(this, void 0, void 0, function* () {
        // Each allowed tags should have some common global attributes...
        sanitizeConfig.allowedTags.forEach((tag) => {
            sanitizeConfig.allowedAttributes[tag] = _.union(sanitizeConfig.allowedAttributes[tag], sanitizeConfig.globalAttributes);
        });
        // Some plugins might need to adjust or whitelist their own tags...
        sanitizeConfig = (yield plugins.hooks.fire('filter:sanitize.config', sanitizeConfig));
    });
    // learned how to implmenet promises here: https://stackoverflow.com/questions/35318442/how-to-pass-parameter-to-a-promise-function
    Posts.registerHooks = () => {
        plugins.hooks.register('core', {
            hook: 'filter:parse.post',
            method: function (data) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield new Promise((resolve) => {
                        data.postData.content = Posts.sanitize(data.postData.content);
                        resolve('Obtained');
                    });
                    return data;
                });
            },
        });
        plugins.hooks.register('core', {
            hook: 'filter:parse.raw',
            method: function (content) {
                return __awaiter(this, void 0, void 0, function* () {
                    return yield new Promise((resolve) => {
                        Posts.sanitize(content);
                        resolve('Obtained');
                    });
                });
            },
        });
        plugins.hooks.register('core', {
            hook: 'filter:parse.aboutme',
            method: function (content) {
                return __awaiter(this, void 0, void 0, function* () {
                    return yield new Promise((resolve) => {
                        Posts.sanitize(content);
                        resolve('Obtained');
                    });
                });
            },
        });
        plugins.hooks.register('core', {
            hook: 'filter:parse.signature',
            method: function (data) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield new Promise((resolve) => {
                        data.userData.signature = Posts.sanitize(data.userData.signature);
                        resolve('Obtained');
                    });
                    return data;
                });
            },
        });
    };
}
module.exports = ParsePosts;
