import nconf from 'nconf';
import url from 'url';
import winston from 'winston';
import path from 'path';
import chalk from 'chalk';
import semver from 'semver';
import pkg from '../package.json';
import { paths } from './constants';

export function setupWinston(): void {
    if (!winston.format) {
        return;
    }

    const formats: winston.Logform.Format[] = [];
    if (String(nconf.get('log-colorize')) !== 'false') {
        formats.push(winston.format.colorize());
    }

    if (String(nconf.get('json-logging'))) {
        formats.push(winston.format.timestamp());
        formats.push(winston.format.json());
    } else {
        const timestampFormat = winston.format((info) => {
            const dateString = `${new Date().toString()} [${String(nconf.get('port'))}/${global.process.pid}]`;
            info.level = `${dateString} - ${info.level}`;
            return info;
        });
        formats.push(timestampFormat());
        formats.push(winston.format.splat());
        formats.push(winston.format.simple());
    }

    // .apply() produces an array of 'any' so used work around below
    const nf = formats.length;
    let myFormat = winston.format.combine(formats[0], formats[1]);
    if (nf === 3) {
        myFormat = winston.format.combine(formats[0], formats[1], formats[2]);
    } else {
        winston.format.combine(formats[0], formats[1], formats[2], formats[3]);
    }
    winston.configure({
        level: String(nconf.get('log-level')) || (process.env.NODE_ENV === 'production' ? 'info' : 'verbose'),
        // format: winston.format.combine.apply(null, formats),
        format: myFormat,
        transports: [
            new winston.transports.Console({
                handleExceptions: true,
            }),
        ],
    });
}

export function loadConfig(configFile: string): void {
    nconf.file({
        file: configFile,
    });

    nconf.defaults({
        base_dir: paths.baseDir,
        themes_path: paths.themes,
        upload_path: 'public/uploads',
        views_dir: path.join(paths.baseDir, 'build/public/templates'),
        version: pkg.version,
        isCluster: false,
        isPrimary: true,
        jobsDisabled: false,
    });

    // Explicitly cast as Bool, loader.js passes in isCluster as string 'true'/'false'
    const castAsBool: string[] = ['isCluster', 'isPrimary', 'jobsDisabled'];
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    nconf.stores.env.readOnly = false;
    castAsBool.forEach((prop) => {
        const value = String(nconf.get(prop));
        if (value !== undefined) {
            nconf.set(prop, ['1', 1, 'true', true].includes(value));
        }
    });
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    nconf.stores.env.readOnly = true;
    nconf.set('runJobs', nconf.get('isPrimary') && !nconf.get('jobsDisabled'));

    // Ensure themes_path is a full filepath
    nconf.set('themes_path', path.resolve(paths.baseDir, String(nconf.get('themes_path'))));
    nconf.set('core_templates_path', path.join(paths.baseDir, 'src/views'));
    nconf.set('base_templates_path', path.join(String(nconf.get('themes_path')), 'nodebb-theme-persona/templates'));

    nconf.set('upload_path', path.resolve(String(nconf.get('base_dir')), String(nconf.get('upload_path'))));
    nconf.set('upload_url', '/assets/uploads');


    // nconf defaults, if not set in config
    if (!nconf.get('sessionKey')) {
        nconf.set('sessionKey', 'express.sid');
    }

    if (nconf.get('url')) {
        nconf.set('url', String(nconf.get('url')).replace(/\/$/, ''));
        nconf.set('url_parsed', url.parse(String(nconf.get('url'))));
        // Parse out the relative_url and other goodies from the configured URL
        const urlObject = url.parse(String(nconf.get('url')));
        const relativePath = urlObject.pathname !== '/' ? urlObject.pathname.replace(/\/+$/, '') : '';
        nconf.set('base_url', `${urlObject.protocol}//${urlObject.host}`);
        nconf.set('secure', urlObject.protocol === 'https:');
        nconf.set('use_port', !!urlObject.port);
        nconf.set('relative_path', relativePath);
        if (!nconf.get('asset_base_url')) {
            nconf.set('asset_base_url', `${relativePath}/assets`);
        }
        nconf.set('port', String(nconf.get('PORT')) || String(nconf.get('port')) || urlObject.port || (String(nconf.get('PORT_ENV_VAR')) ? String(nconf.get(String(nconf.get('PORT_ENV_VAR')))) : false) || 4567);

        // cookies don't provide isolation by port: http://stackoverflow.com/a/16328399/122353
        const domain = String(nconf.get('cookieDomain')) || urlObject.hostname;
        const origins = String(nconf.get('socket.io:origins')) || `${urlObject.protocol}//${domain}:*`;
        nconf.set('socket.io:origins', origins);
    }
}

export function versionCheck(): void {
    const version = process.version.slice(1);
    const range = pkg.engines.node;
    const compatible = semver.satisfies(version, range);

    if (!compatible) {
        winston.warn('Your version of Node.js is too outdated for NodeBB. Please update your version of Node.js.');
        winston.warn(`Recommended ${chalk.green(range)}, ${chalk.yellow(version)} provided\n`);
    }
}
