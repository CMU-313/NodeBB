import fs = require('fs');
import path = require('path');
import utils = require('./utils');
import constants = require('./constants');
import paths = constants.paths;
import plugins = require('./plugins');
import promisify = require('./promisify');

const languagesPath = path.join(__dirname, '../build/public/language');

const files = fs.readdirSync(path.join(paths.nodeModules, '/timeago/locales'));
const timeagoCodes = files.filter(f => f.startsWith('jquery.timeago')).map(f => f.split('.')[2]);

type GetResult = {
    language: string,
    namespace: string,
    data: unknown,
};

const get = async function (language: string, namespace: string): Promise<unknown> {
    const pathToLanguageFile: string = path.join(languagesPath, language, `${namespace}.json`);
    if (!pathToLanguageFile.startsWith(languagesPath)) {
        throw new Error('[[error:invalid-path]]');
    }
    const data = await fs.promises.readFile(pathToLanguageFile, 'utf8');
    const parsed: unknown = JSON.parse(data) || {};
    const result = await plugins.hooks.fire('filter:languages.get', {
        language,
        namespace,
        data: parsed,
    }) as GetResult;
    return result.data;
};

type LanguagesMetadata = {
    languages: string[],
};

let codeCache: string[] | null = null;
const listCodes = async function (): Promise<string[]> {
    if (codeCache && codeCache.length) {
        return codeCache;
    }
    try {
        const file = await fs.promises.readFile(path.join(languagesPath, 'metadata.json'), 'utf8');
        const parsed = JSON.parse(file) as LanguagesMetadata;

        codeCache = parsed.languages;
        return parsed.languages;
    } catch (err) {
        if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
            return [];
        }
        throw err;
    }
};

type LanguageInfo = {
    name: string,
    code: string,
    dir: string,
};

let listCache: LanguageInfo[] | null = null;
const list = async function (): Promise<LanguageInfo[]> {
    if (listCache && listCache.length) {
        return listCache;
    }

    const codes = await listCodes();

    let languages = await Promise.all(codes.map(async (folder) => {
        try {
            const configPath = path.join(languagesPath, folder, 'language.json');
            const file = await fs.promises.readFile(configPath, 'utf8');
            const lang = JSON.parse(file) as LanguageInfo;
            return lang;
        } catch (err) {
            if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
                return;
            }
            throw err;
        }
    }));

    // filter out invalid ones
    languages = languages.filter(lang => lang && lang.code && lang.name && lang.dir);

    listCache = languages;
    return languages;
};

const userTimeagoCode = async function (userLang: string): Promise<string> {
    const languageCodes = await listCodes();
    const timeagoCode = utils.userLangToTimeagoCode(userLang) as string;
    if (languageCodes.includes(userLang) && timeagoCodes.includes(timeagoCode)) {
        return timeagoCode;
    }
    return '';
};

module.exports = {
    timeagoCodes,
    get,
    listCodes,
    list,
    userTimeagoCode,
};

promisify(module.exports);
