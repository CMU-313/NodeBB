import nconf = require('nconf');
import url = require('url');
import winston = require('winston');
import sanitize = require('sanitize-html');
import _ = require('lodash');
import meta = require('../meta');
import plugins = require('../plugins');
import translator = require('../translator');
import utils = require('../utils');
import cache = require('../cache');

interface SanitizeConfig {
    allowedTags: string[],
    allowedAttributes: {
        // ...sanitize.defaults: sanitizeHtml.IDefaults;
        a: string[];
        img: string[];
        iframe: string[];
        video: string[];
        audio: string[];
        embed: string[]
    },
    globalAttributes: string[],
}

interface PostDataType {
    content: string;
    pid: string;
    cachedContent: string | undefined;
}

interface DataType {
    postData: PostDataType
}

interface UserDataType {
    signature: string
}

interface RegExpType {
    regex: RegExp;
    length: number;
}

interface ParsedType {
    protocol: string
}

interface PostType {
    urlRegex: {
        regex: RegExp;
        length: number;
    };
    imgRegex: {
        regex: RegExp;
        length: number;
    };

    parsePost: (postData:PostDataType) => Promise<PostDataType>;
    parseSignature: (userData:UserDataType, uid:string) => Promise<string>;
    relativeToAbsolute: (content:string, regex:RegExpType) => string
    sanitize: (content:string) => string;
    configureSanitize: () => Promise<void>;
    registerHooks: () => void;
}

interface UserDataTypeStorage {
    userData: UserDataType
}

let sanitizeConfig = {} as SanitizeConfig;
sanitizeConfig.allowedTags = sanitize.defaults.allowedTags.concat([
    // Some safe-to-use tags to add
    'sup', 'ins', 'del', 'img', 'button',
    'video', 'audio', 'iframe', 'embed',
    // 'sup' still necessary until https://github.com/apostrophecms/sanitize-html/pull/422 merged
]);
sanitizeConfig.allowedAttributes = {
    ...sanitize.defaults.allowedAttributes,
    a: ['href', 'name', 'hreflang', 'media', 'rel', 'target', 'type'],
    img: ['alt', 'height', 'ismap', 'src', 'usemap', 'width', 'srcset'],
    iframe: ['height', 'name', 'src', 'width'],
    video: ['autoplay', 'controls', 'height', 'loop', 'muted', 'poster', 'preload', 'src', 'width'],
    audio: ['autoplay', 'controls', 'loop', 'muted', 'preload', 'src'],
    embed: ['height', 'src', 'type', 'width'],
};
sanitizeConfig.globalAttributes = ['accesskey', 'class', 'contenteditable', 'dir',
    'draggable', 'dropzone', 'hidden', 'id', 'lang', 'spellcheck', 'style',
    'tabindex', 'title', 'translate', 'aria-expanded', 'data-*',
];


function ParsePosts(Posts: PostType) {
    function sanitizeSignature(signature: string) {
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

    Posts.parsePost = async function (postData: PostDataType) {
        if (!postData) {
            return postData;
        }
        postData.content = String(postData.content || '');

        const pid = String(postData.pid);

        const cachedContent:string = cache.get(pid) as string;
        if (postData.pid && cachedContent !== undefined) {
            postData.content = cachedContent;
            return postData;
        }

        const data:DataType = await plugins.hooks.fire('filter:parse.post', { postData: postData }) as DataType;
        data.postData.content = translator.escape(data.postData.content);
        if (data.postData.pid) {
            cache.set(pid, data.postData.content);
        }
        return data.postData;
    };

    Posts.parseSignature = async function (userData, uid) {
        userData.signature = sanitizeSignature(userData.signature || '');
        return await plugins.hooks.fire('filter:parse.signature', { userData: userData, uid: uid }) as Promise<string>;
    };

    Posts.relativeToAbsolute = function (content:string, regex:RegExpType) {
        // Turns relative links in content to absolute urls
        if (!content) {
            return content;
        }
        let parsed:ParsedType;
        let current = regex.regex.exec(content);
        let absolute:string;
        while (current !== null) {
            if (current[1]) {
                try {
                    parsed = url.parse(current[1]);
                    if (!parsed.protocol) {
                        if (current[1].startsWith('/')) {
                            // Internal link
                            const base_url:string = nconf.get('base_url') as string;
                            absolute = base_url + current[1].toString();
                        } else {
                            // External link
                            absolute = `//${current[1]}`;
                        }

                        content = content.slice(0, current.index + regex.length) +
                        absolute +
                        content.slice(current.index + regex.length + current[1].length);
                    }
                } catch (err:unknown) {
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

    Posts.configureSanitize = async () => {
        // Each allowed tags should have some common global attributes...
        sanitizeConfig.allowedTags.forEach((tag) => {
            sanitizeConfig.allowedAttributes[tag] = _.union(
                sanitizeConfig.allowedAttributes[tag],
                sanitizeConfig.globalAttributes
            );
        });

        // Some plugins might need to adjust or whitelist their own tags...
        sanitizeConfig = await plugins.hooks.fire('filter:sanitize.config', sanitizeConfig) as SanitizeConfig;
    };

    // learned how to implmenet promises here: https://stackoverflow.com/questions/35318442/how-to-pass-parameter-to-a-promise-function
    Posts.registerHooks = () => {
        plugins.hooks.register('core', {
            hook: 'filter:parse.post',
            method: async function (data:DataType) {
                await new Promise((resolve) => {
                    data.postData.content = Posts.sanitize(data.postData.content);
                    resolve('Obtained');
                });
                return data;
            },
        });

        plugins.hooks.register('core', {
            hook: 'filter:parse.raw',
            method: async function (content: string) {
                return await new Promise((resolve) => {
                    Posts.sanitize(content);
                    resolve('Obtained');
                });
            },
        });

        plugins.hooks.register('core', {
            hook: 'filter:parse.aboutme',
            method: async function (content:string) {
                return await new Promise((resolve) => {
                    Posts.sanitize(content);
                    resolve('Obtained');
                });
            },
        });

        plugins.hooks.register('core', {
            hook: 'filter:parse.signature',
            method: async function (data:UserDataTypeStorage) {
                await new Promise((resolve) => {
                    data.userData.signature = Posts.sanitize(data.userData.signature);
                    resolve('Obtained');
                });
                return data;
            },
        });
    };
}

export = ParsePosts;
