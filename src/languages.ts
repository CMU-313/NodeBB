// 'use strict';
// const fs = require('fs');
// const path = require('path');
// const utils = require('./utils');
// const { paths } = require('./constants');
// const plugins = require('./plugins');

import fs from 'fs';
import path from 'path';
import utils from './utils';
import { paths } from './constants';
import plugins from './plugins';
import './promisify';


interface Language {
    code: string;
    name: string;
    dir: string;
}

interface LanguageData {
    [key: string]: string | number | boolean | object;
}

interface LanguageMetadata {
    languages: string[];
}

interface NodeError extends Error {
    code?: string;
}

// interface PluginsHooks {
//     fire(event: string, data: any): Promise<string>;
// }

interface ResultType {
    data: LanguageData;
}

const languagesPath = path.join(__dirname, '../build/public/language');

const files = fs.readdirSync(path.join(paths.nodeModules, '/timeago/locales'));
export const timeagoCodes: string[] = files.filter(f => f.startsWith('jquery.timeago')).map(f => f.split('.')[2]);

export const get = async (language: string, namespace: string): Promise<LanguageData> => {
    const pathToLanguageFile = path.join(languagesPath, language, `${namespace}.json`);
    if (!pathToLanguageFile.startsWith(languagesPath)) {
        throw new Error('[[error:invalid-path]]');
    }
    const data = await fs.promises.readFile(pathToLanguageFile, 'utf8');
    const parsed: LanguageData = JSON.parse(data) as LanguageData;
    const result: ResultType = await plugins.hooks.fire('filter:languages.get', {
        language,
        namespace,
        data: parsed,
    }) as ResultType;
    return result.data;
};

let codeCache: string[] | null = null;
export const listCodes = async (): Promise<string[]> => {
    if (codeCache && codeCache.length) {
        return codeCache;
    }
    try {
        const file = await fs.promises.readFile(path.join(languagesPath, 'metadata.json'), 'utf8');
        const parsed = JSON.parse(file) as LanguageMetadata;

        codeCache = parsed.languages;
        return parsed.languages;
    } catch (err) {
        const nodeError = err as NodeError;
        if (nodeError.code === 'ENOENT') {
            return [];
        }
        throw err;
    }
};

let listCache: Language[] | null = null;
export const list = async (): Promise<Language[]> => {
    if (listCache && listCache.length) {
        return listCache;
    }

    const codes = await listCodes();

    let languages = await Promise.all(codes.map(async (folder) => {
        try {
            const configPath = path.join(languagesPath, folder, 'language.json');
            const file = await fs.promises.readFile(configPath, 'utf8');
            const lang = JSON.parse(file) as Language;
            return lang;
        } catch (err) {
            const nodeError = err as NodeError;
            if (nodeError.code === 'ENOENT') {
                return;
            }
            throw err;
        }
    }));

    languages = languages.filter(lang => lang && lang.code && lang.name && lang.dir);

    listCache = languages;
    return languages;
};

export const userTimeagoCode = async (userLang: string): Promise<string> => {
    const languageCodes = await listCodes();
    const timeagoCode = utils.userLangToTimeagoCode(userLang) as string;
    if (languageCodes.includes(userLang) && timeagoCodes.includes(timeagoCode)) {
        return timeagoCode;
    }
    return '';
};

// import './promisify';

// const languagesPath = path.join
// const Languages = module.exports;
// const languagesPath = path.join(__dirname, '../build/public/language');

// const files = fs.readdirSync(path.join(paths.nodeModules, '/timeago/locales'));
// Languages.timeagoCodes = files.filter(f => f.startsWith('jquery.timeago')).map(f => f.split('.')[2]);

// Languages.get = async function (language, namespace) {
//     const pathToLanguageFile = path.join(languagesPath, language, `${namespace}.json`);
//     if (!pathToLanguageFile.startsWith(languagesPath)) {
//         throw new Error('[[error:invalid-path]]');
//     }
//     const data = await fs.promises.readFile(pathToLanguageFile, 'utf8');
//     const parsed = JSON.parse(data) || {};
//     const result = await plugins.hooks.fire('filter:languages.get', {
//         language,
//         namespace,
//         data: parsed,
//     });
//     return result.data;
// };

// let codeCache = null;
// Languages.listCodes = async function () {
//     if (codeCache && codeCache.length) {
//         return codeCache;
//     }
//     try {
//         const file = await fs.promises.readFile(path.join(languagesPath, 'metadata.json'), 'utf8');
//         const parsed = JSON.parse(file);

//         codeCache = parsed.languages;
//         return parsed.languages;
//     } catch (err) {
//         if (err.code === 'ENOENT') {
//             return [];
//         }
//         throw err;
//     }
// };

// let listCache = null;
// Languages.list = async function () {
//     if (listCache && listCache.length) {
//         return listCache;
//     }

//     const codes = await Languages.listCodes();

//     let languages = await Promise.all(codes.map(async (folder) => {
//         try {
//             const configPath = path.join(languagesPath, folder, 'language.json');
//             const file = await fs.promises.readFile(configPath, 'utf8');
//             const lang = JSON.parse(file);
//             return lang;
//         } catch (err) {
//             if (err.code === 'ENOENT') {
//                 return;
//             }
//             throw err;
//         }
//     }));

//     // filter out invalid ones
//     languages = languages.filter(lang => lang && lang.code && lang.name && lang.dir);

//     listCache = languages;
//     return languages;
// };

// Languages.userTimeagoCode = async function (userLang) {
//     const languageCodes = await Languages.listCodes();
//     const timeagoCode = utils.userLangToTimeagoCode(userLang);
//     if (languageCodes.includes(userLang) && Languages.timeagoCodes.includes(timeagoCode)) {
//         return timeagoCode;
//     }
//     return '';
// };

// require('./promisify')(Languages);
