import path from 'path';

import fs from 'fs';

import semver from 'semver';

import winston from 'winston';

import chalk from 'chalk';

import { paths, pluginNamePattern } from '../constants';

// added "resolveJsonModule": true to tsconfig.json
import pkg from '../../package.json';

type resolveType = {
    includes(uri: string) : boolean;
}

class SemVer2 extends semver.SemVer {
    _resolved?: resolveType;

    name: string;
}

interface depexport {
    check: () => Promise<void>;
    checkModule(moduleName : string) : Promise<boolean>;
    parseModuleData(moduleName : string, pkgData : string) : SemVer2 | null;
    doesSatisfy(moduleData : SemVer2, packageJSONVersion : string) : boolean;
}
const Dependencies : depexport = module.exports as depexport;

let depsMissing = false;
let depsOutdated = false;

Dependencies.check = async function () {
    const modules = Object.keys(pkg.dependencies);

    winston.verbose('Checking dependencies for outdated modules');

    await Promise.all(modules.map(module => Dependencies.checkModule(module)));

    if (depsMissing) {
        throw new Error('dependencies-missing');
    } else if (depsOutdated && global.env !== 'development') {
        throw new Error('dependencies-out-of-date');
    }
};

Dependencies.checkModule = async function (moduleName) {
    try {
        const pkgData = await fs.promises.readFile(path.join(paths.nodeModules, moduleName, 'package.json'), 'utf8');
        const moduleData = Dependencies.parseModuleData(moduleName, pkgData);

        const satisfies = Dependencies.doesSatisfy(moduleData, pkg.dependencies[moduleName] as string);
        return satisfies;
    } catch (err) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const message : string = err.code as string;
        if (message === 'ENOENT' && pluginNamePattern.test(moduleName)) {
            winston.warn(`[meta/dependencies] Bundled plugin ${moduleName} not found, skipping dependency check.`);
            return true;
        }
        throw err;
    }
};

Dependencies.parseModuleData = function (moduleName, pkgData) {
    try {
        pkgData = JSON.parse(pkgData) as string;
    } catch (e) {
        winston.warn(`[${chalk.red('missing')}] ${chalk.bold(moduleName)} is a required dependency but could not be found\n`);
        depsMissing = true;
        return null;
    }
    const moduleData = new SemVer2(pkgData);
    return moduleData;
};

Dependencies.doesSatisfy = function (moduleData, packageJSONVersion) {
    if (!moduleData) {
        return false;
    }
    const versionOk : boolean = !semver.validRange(packageJSONVersion) ||
        semver.satisfies(moduleData.version, packageJSONVersion);
    const githubRepo : boolean = (moduleData._resolved && moduleData._resolved.includes('//github.com'));
    const satisfies : boolean = versionOk || githubRepo;
    if (!satisfies) {
        winston.warn(`[${chalk.yellow('outdated')}] ${chalk.bold(moduleData.name)} installed v${moduleData.version}, package.json requires ${packageJSONVersion}\n`);
        depsOutdated = true;
    }
    return satisfies;
};
