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
exports.userTimeagoCode = exports.list = exports.listCodes = exports.get = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = __importDefault(require("./utils"));
const constants_1 = require("./constants");
const plugins_1 = __importDefault(require("./plugins"));
const languagesPath = path_1.default.join(__dirname, '../build/public/language');
const files = fs_1.default.readdirSync(path_1.default.join(constants_1.paths.nodeModules, '/timeago/locales'));
const timeagoCodes = files.filter(f => f.startsWith('jquery.timeago')).map(f => f.split('.')[2]);
function get(language, namespace) {
    return __awaiter(this, void 0, void 0, function* () {
        const pathToLanguageFile = path_1.default.join(languagesPath, language, `${namespace}.json`);
        if (!pathToLanguageFile.startsWith(languagesPath)) {
            throw new Error('[[error:invalid-path]]');
        }
        const data = yield fs_1.default.promises.readFile(pathToLanguageFile, 'utf8');
        const parsed = JSON.parse(data) || {};
        const result = yield plugins_1.default.hooks.fire('filter:languages.get', {
            language,
            namespace,
            data: parsed,
        });
        return result.data;
    });
}
exports.get = get;
// https://stackoverflow.com/questions/69422525/in-typescript-try-catch-error-object-shows-object-is-of-type-unknown-ts25
function isErrnoException(e) {
    return e instanceof Error;
}
let codeCache = null;
function listCodes() {
    return __awaiter(this, void 0, void 0, function* () {
        if (codeCache && codeCache.length) {
            return codeCache;
        }
        try {
            const file = yield fs_1.default.promises.readFile(path_1.default.join(languagesPath, 'metadata.json'), 'utf8');
            const parsed = JSON.parse(file);
            codeCache = parsed.languages;
            return parsed.languages;
        }
        catch (err) {
            if (isErrnoException(err)) {
                if (err.code === 'ENOENT') {
                    return [];
                }
                throw err;
            }
        }
    });
}
exports.listCodes = listCodes;
let listCache = null;
function list() {
    return __awaiter(this, void 0, void 0, function* () {
        if (listCache && listCache.length) {
            return listCache;
        }
        const codes = yield listCodes();
        let languages = [];
        languages = yield Promise.all(codes.map((folder) => __awaiter(this, void 0, void 0, function* () {
            try {
                const configPath = path_1.default.join(languagesPath, folder, 'language.json');
                const file = yield fs_1.default.promises.readFile(configPath, 'utf8');
                const lang = JSON.parse(file);
                return lang;
            }
            catch (err) {
                if (isErrnoException(err)) {
                    if (err.code === 'ENOENT') {
                        return;
                    }
                    throw err;
                }
            }
        })));
        // filter out invalid ones
        languages = languages.filter(lang => lang && lang.code && lang.name && lang.dir);
        listCache = languages;
        return languages;
    });
}
exports.list = list;
function userTimeagoCode(userLang) {
    return __awaiter(this, void 0, void 0, function* () {
        const languageCodes = yield listCodes();
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const timeagoCode = utils_1.default.userLangToTimeagoCode(userLang);
        if (languageCodes.includes(userLang) && timeagoCodes.includes(timeagoCode)) {
            return timeagoCode;
        }
        return '';
    });
}
exports.userTimeagoCode = userTimeagoCode;
