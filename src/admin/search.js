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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitize = exports.simplify = exports.filterDirectories = exports.getDictionary = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const nconf_1 = __importDefault(require("nconf"));
const winston_1 = __importDefault(require("winston"));
const file_1 = __importDefault(require("../file"));
const translator_1 = require("../translator");
function filterDirectories(directories) {
    return directories
        .map(
    // get the relative path
    // convert dir to use forward slashes
    dir => dir
        .replace(/^.*(admin.*?).tpl$/, '$1')
        .split(path_1.default.sep)
        .join('/'))
        .filter(
    // exclude .js files
    // exclude partials
    // only include subpaths
    // exclude category.tpl, group.tpl, category-analytics.tpl
    dir => !dir.endsWith('.js') &&
        !dir.includes('/partials/') &&
        /\/.*\//.test(dir) &&
        !/manage\/(category|group|category-analytics)$/.test(dir));
}
exports.filterDirectories = filterDirectories;
function getAdminNamespaces() {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const directories = yield file_1.default.walk(path_1.default.resolve(nconf_1.default.get('views_dir'), 'admin'));
        return filterDirectories(directories);
    });
}
function sanitize(html) {
    // reduce the template to just meaningful text
    // remove all tags and strip out scripts, etc completely
    return (0, sanitize_html_1.default)(html, {
        allowedTags: [],
        allowedAttributes: false,
    });
}
exports.sanitize = sanitize;
function simplify(translations) {
    return (translations
        // remove all mustaches
        .replace(/(?:\{{1,2}[^}]*?\}{1,2})/g, '')
        // collapse whitespace
        .replace(/(?:[ \t]*[\n\r]+[ \t]*)+/g, '\n')
        .replace(/[\t ]+/g, ' '));
}
exports.simplify = simplify;
function nsToTitle(namespace) {
    return namespace
        .replace('admin/', '')
        .split('/')
        .map(str => str[0].toUpperCase() + str.slice(1))
        .join(' > ')
        .replace(/[^a-zA-Z> ]/g, ' ');
}
const fallbackCache = {};
function initFallback(namespace) {
    return __awaiter(this, void 0, void 0, function* () {
        const template = yield fs_1.default.promises.readFile(path_1.default.resolve(nconf_1.default.get('views_dir'), `${namespace}.tpl`), 'utf8');
        const title = nsToTitle(namespace);
        let translations = sanitize(template);
        translations = translator_1.Translator.removePatterns(translations);
        translations = simplify(translations);
        translations += `\n${title}`;
        return {
            namespace: namespace,
            translations: translations,
            title: title,
        };
    });
}
function fallback(namespace) {
    return __awaiter(this, void 0, void 0, function* () {
        if (fallbackCache[namespace]) {
            return fallbackCache[namespace];
        }
        const params = yield initFallback(namespace);
        fallbackCache[namespace] = params;
        return params;
    });
}
function initDict(language) {
    return __awaiter(this, void 0, void 0, function* () {
        const namespaces = yield getAdminNamespaces();
        return yield Promise.all(
        // This lint rule is unnecessary because of function hosting at the module scope
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        namespaces.map(ns => buildNamespace(language, ns)));
    });
}
function buildNamespace(language, namespace) {
    return __awaiter(this, void 0, void 0, function* () {
        const translator = translator_1.Translator.create(language);
        try {
            const translations = yield translator.getTranslation(namespace);
            if (!translations || !Object.keys(translations).length) {
                return yield fallback(namespace);
            }
            // join all translations into one string separated by newlines
            let str = Object.keys(translations)
                .map(key => translations[key])
                .join('\n');
            str = sanitize(str);
            let title = namespace;
            title = title.match(/admin\/(.+?)\/(.+?)$/);
            title = `[[admin/menu:section-${title[1] === 'development' ? 'advanced' : title[1]}]]${title[2] ? ` > [[admin/menu:${title[1]}/${title[2]}]]` : ''}`;
            title = yield translator.translate(title);
            return {
                namespace: namespace,
                translations: `${str}\n${title}`,
                title: title,
            };
        }
        catch (err) {
            winston_1.default.error(err.stack);
            return {
                namespace: namespace,
                translations: '',
            };
        }
    });
}
const cache = {};
function getDictionary(language) {
    return __awaiter(this, void 0, void 0, function* () {
        if (cache[language]) {
            return cache[language];
        }
        const params = yield initDict(language);
        cache[language] = params;
        return params;
    });
}
exports.getDictionary = getDictionary;
