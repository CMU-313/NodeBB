"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.versionCheck = exports.loadConfig = exports.setupWinston = void 0;
const nconf_1 = __importDefault(require("nconf"));
const url_1 = __importDefault(require("url"));
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const semver_1 = __importDefault(require("semver"));
const package_json_1 = __importDefault(require("../package.json"));
const constants_1 = require("./constants");
function setupWinston() {
    if (!winston_1.default.format) {
        return;
    }
    const formats = [];
    if (String(nconf_1.default.get('log-colorize')) !== 'false') {
        formats.push(winston_1.default.format.colorize());
    }
    if (String(nconf_1.default.get('json-logging'))) {
        formats.push(winston_1.default.format.timestamp());
        formats.push(winston_1.default.format.json());
    }
    else {
        const timestampFormat = winston_1.default.format((info) => {
            const dateString = `${new Date().toString()} [${String(nconf_1.default.get('port'))}/${global.process.pid}]`;
            info.level = `${dateString} - ${info.level}`;
            return info;
        });
        formats.push(timestampFormat());
        formats.push(winston_1.default.format.splat());
        formats.push(winston_1.default.format.simple());
    }
    // .apply() produces an array of 'any' so used work around below
    const nf = formats.length;
    let myFormat = winston_1.default.format.combine(formats[0], formats[1]);
    if (nf === 3) {
        myFormat = winston_1.default.format.combine(formats[0], formats[1], formats[2]);
    }
    else {
        winston_1.default.format.combine(formats[0], formats[1], formats[2], formats[3]);
    }
    winston_1.default.configure({
        level: String(nconf_1.default.get('log-level')) || (process.env.NODE_ENV === 'production' ? 'info' : 'verbose'),
        // format: winston.format.combine.apply(null, formats),
        format: myFormat,
        transports: [
            new winston_1.default.transports.Console({
                handleExceptions: true,
            }),
        ],
    });
}
exports.setupWinston = setupWinston;
function loadConfig(configFile) {
    nconf_1.default.file({
        file: configFile,
    });
    nconf_1.default.defaults({
        base_dir: constants_1.paths.baseDir,
        themes_path: constants_1.paths.themes,
        upload_path: 'public/uploads',
        views_dir: path_1.default.join(constants_1.paths.baseDir, 'build/public/templates'),
        version: package_json_1.default.version,
        isCluster: false,
        isPrimary: true,
        jobsDisabled: false,
    });
    // Explicitly cast as Bool, loader.js passes in isCluster as string 'true'/'false'
    const castAsBool = ['isCluster', 'isPrimary', 'jobsDisabled'];
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    nconf_1.default.stores.env.readOnly = false;
    castAsBool.forEach((prop) => {
        const value = String(nconf_1.default.get(prop));
        if (value !== undefined) {
            nconf_1.default.set(prop, ['1', 1, 'true', true].includes(value));
        }
    });
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    nconf_1.default.stores.env.readOnly = true;
    nconf_1.default.set('runJobs', nconf_1.default.get('isPrimary') && !nconf_1.default.get('jobsDisabled'));
    // Ensure themes_path is a full filepath
    nconf_1.default.set('themes_path', path_1.default.resolve(constants_1.paths.baseDir, String(nconf_1.default.get('themes_path'))));
    nconf_1.default.set('core_templates_path', path_1.default.join(constants_1.paths.baseDir, 'src/views'));
    nconf_1.default.set('base_templates_path', path_1.default.join(String(nconf_1.default.get('themes_path')), 'nodebb-theme-persona/templates'));
    nconf_1.default.set('upload_path', path_1.default.resolve(String(nconf_1.default.get('base_dir')), String(nconf_1.default.get('upload_path'))));
    nconf_1.default.set('upload_url', '/assets/uploads');
    // nconf defaults, if not set in config
    if (!nconf_1.default.get('sessionKey')) {
        nconf_1.default.set('sessionKey', 'express.sid');
    }
    if (nconf_1.default.get('url')) {
        nconf_1.default.set('url', String(nconf_1.default.get('url')).replace(/\/$/, ''));
        nconf_1.default.set('url_parsed', url_1.default.parse(String(nconf_1.default.get('url'))));
        // Parse out the relative_url and other goodies from the configured URL
        const urlObject = url_1.default.parse(String(nconf_1.default.get('url')));
        const relativePath = urlObject.pathname !== '/' ? urlObject.pathname.replace(/\/+$/, '') : '';
        nconf_1.default.set('base_url', `${urlObject.protocol}//${urlObject.host}`);
        nconf_1.default.set('secure', urlObject.protocol === 'https:');
        nconf_1.default.set('use_port', !!urlObject.port);
        nconf_1.default.set('relative_path', relativePath);
        if (!nconf_1.default.get('asset_base_url')) {
            nconf_1.default.set('asset_base_url', `${relativePath}/assets`);
        }
        nconf_1.default.set('port', String(nconf_1.default.get('PORT')) || String(nconf_1.default.get('port')) || urlObject.port || (String(nconf_1.default.get('PORT_ENV_VAR')) ? String(nconf_1.default.get(String(nconf_1.default.get('PORT_ENV_VAR')))) : false) || 4567);
        // cookies don't provide isolation by port: http://stackoverflow.com/a/16328399/122353
        const domain = String(nconf_1.default.get('cookieDomain')) || urlObject.hostname;
        const origins = String(nconf_1.default.get('socket.io:origins')) || `${urlObject.protocol}//${domain}:*`;
        nconf_1.default.set('socket.io:origins', origins);
    }
}
exports.loadConfig = loadConfig;
function versionCheck() {
    const version = process.version.slice(1);
    const range = package_json_1.default.engines.node;
    const compatible = semver_1.default.satisfies(version, range);
    if (!compatible) {
        winston_1.default.warn('Your version of Node.js is too outdated for NodeBB. Please update your version of Node.js.');
        winston_1.default.warn(`Recommended ${chalk_1.default.green(range)}, ${chalk_1.default.yellow(version)} provided\n`);
    }
}
exports.versionCheck = versionCheck;
