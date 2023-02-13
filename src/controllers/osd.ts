import xml from 'xml';
import nconf from 'nconf';
import { NextFunction } from 'express';
import plugins from '../plugins';
import meta from '../meta';


function trimToLength(string: string, length: number):string {
    return string.trim().substring(0, length).trim();
}


function generateXML(): string {
    const x : string = xml([{
        OpenSearchDescription: [
            {
                _attr: {
                    xmlns: 'http://a9.com/-/spec/opensearch/1.1/',
                    'xmlns:moz': 'http://www.mozilla.org/2006/browser/search/',
                },
            },
            { ShortName: trimToLength(String(meta.configs.title || meta.configs.browserTitle || 'NodeBB'), 16) },
            { Description: trimToLength(String(meta.configs.description || ''), 1024) },
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
                    `${(nconf.get('url')) as string}/favicon.ico`,
                ],
            },
            {
                Url: {
                    _attr: {
                        type: 'text/html',
                        method: 'get',
                        template: `${(nconf.get('url')) as string}/search?term={searchTerms}&in=titlesposts`,
                    },
                },
            },
            { 'moz:SearchForm': `${(nconf.get('url')) as string}/search` },
        ],
    }], { declaration: true, indent: '\t' });
    return x;
}

// eslint-disable-next-line import/prefer-default-export
export function handle(req, res, next:NextFunction): void {
    console.log('osd handl called');
    if (plugins.hooks.hasListeners('filter:search.query')) {
        console.log('if statement');
        console.log(generateXML());

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        res.type('application/opensearchdescription+xml').send(generateXML());
    } else {
        console.log('else');
        next();
    }
}

