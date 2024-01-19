import fs from 'fs';
import path from 'path';
import sanitizeHTML from 'sanitize-html';
import nconf from 'nconf';
import winston from 'winston';

import file from '../file';
import { Translator } from '../translator';

function filterDirectories(directories: string[]) {
    return directories
        .map(
            // get the relative path
            // convert dir to use forward slashes
            dir => dir
                .replace(/^.*(admin.*?).tpl$/, '$1')
                .split(path.sep)
                .join('/')
        )
        .filter(
            // exclude .js files
            // exclude partials
            // only include subpaths
            // exclude category.tpl, group.tpl, category-analytics.tpl
            dir => !dir.endsWith('.js') &&
        !dir.includes('/partials/') &&
        /\/.*\//.test(dir) &&
        !/manage\/(category|group|category-analytics)$/.test(dir)
        );
}

async function getAdminNamespaces() {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const directories = await file.walk(
        path.resolve(nconf.get('views_dir') as string, 'admin')
    ) as string[];
    return filterDirectories(directories);
}

function sanitize(html: string) {
    // reduce the template to just meaningful text
    // remove all tags and strip out scripts, etc completely
    return sanitizeHTML(html, {
        allowedTags: [],
        allowedAttributes: false,
    });
}

function simplify(translations: string) {
    return (
        translations
        // remove all mustaches
            .replace(/(?:\{{1,2}[^}]*?\}{1,2})/g, '')
        // collapse whitespace
            .replace(/(?:[ \t]*[\n\r]+[ \t]*)+/g, '\n')
            .replace(/[\t ]+/g, ' ')
    );
}

function nsToTitle(namespace: string) {
    return namespace
        .replace('admin/', '')
        .split('/')
        .map(str => str[0].toUpperCase() + str.slice(1))
        .join(' > ')
        .replace(/[^a-zA-Z> ]/g, ' ');
}

const fallbackCache: Record<string, Awaited<ReturnType<typeof initFallback>>> = {};

async function initFallback(namespace: string) {
    const template = await fs.promises.readFile(
        path.resolve(nconf.get('views_dir') as string, `${namespace}.tpl`),
        'utf8'
    );

    const title = nsToTitle(namespace);
    let translations = sanitize(template);
    translations = Translator.removePatterns(translations);
    translations = simplify(translations);
    translations += `\n${title}`;

    return {
        namespace: namespace,
        translations: translations,
        title: title,
    };
}

async function fallback(namespace: string) {
    if (fallbackCache[namespace]) {
        return fallbackCache[namespace];
    }

    const params = await initFallback(namespace);
    fallbackCache[namespace] = params;
    return params;
}

async function initDict(language: string) {
    const namespaces = await getAdminNamespaces();
    return await Promise.all(
        // This lint rule is unnecessary because of function hosting at the module scope
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        namespaces.map(ns => buildNamespace(language, ns))
    );
}

async function buildNamespace(language: string, namespace: string) {
    const translator = Translator.create(language);
    try {
        const translations: Record<string, string> = await translator.getTranslation(namespace);
        if (!translations || !Object.keys(translations).length) {
            return await fallback(namespace);
        }
        // join all translations into one string separated by newlines
        let str = Object.keys(translations)
            .map(key => translations[key])
            .join('\n');
        str = sanitize(str);

        let title: string | RegExpMatchArray = namespace;
        title = title.match(/admin\/(.+?)\/(.+?)$/);
        title = `[[admin/menu:section-${
            title[1] === 'development' ? 'advanced' : title[1]
        }]]${title[2] ? ` > [[admin/menu:${title[1]}/${title[2]}]]` : ''}`;

        title = await translator.translate(title);
        return {
            namespace: namespace,
            translations: `${str}\n${title}`,
            title: title,
        };
    } catch (err) {
        winston.error((err as Error).stack);
        return {
            namespace: namespace,
            translations: '',
        };
    }
}

const cache: Record<string, Awaited<ReturnType<typeof initDict>>> = {};

async function getDictionary(language: string) {
    if (cache[language]) {
        return cache[language];
    }

    const params = await initDict(language);
    cache[language] = params;
    return params;
}

export { getDictionary, filterDirectories, simplify, sanitize };
