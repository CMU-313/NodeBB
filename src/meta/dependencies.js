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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const semver_1 = __importDefault(require("semver"));
const winston_1 = __importDefault(require("winston"));
const chalk_1 = __importDefault(require("chalk"));
const constants_1 = require("../constants");
// added "resolveJsonModule": true to tsconfig.json
const package_json_1 = __importDefault(require("../../package.json"));
class SemVer2 extends semver_1.default.SemVer {
}
const Dependencies = module.exports;
let depsMissing = false;
let depsOutdated = false;
Dependencies.check = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const modules = Object.keys(package_json_1.default.dependencies);
        winston_1.default.verbose('Checking dependencies for outdated modules');
        yield Promise.all(modules.map(module => Dependencies.checkModule(module)));
        if (depsMissing) {
            throw new Error('dependencies-missing');
        }
        else if (depsOutdated && global.env !== 'development') {
            throw new Error('dependencies-out-of-date');
        }
    });
};
Dependencies.checkModule = function (moduleName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const pkgData = yield fs_1.default.promises.readFile(path_1.default.join(constants_1.paths.nodeModules, moduleName, 'package.json'), 'utf8');
            const moduleData = Dependencies.parseModuleData(moduleName, pkgData);
            const satisfies = Dependencies.doesSatisfy(moduleData, package_json_1.default.dependencies[moduleName]);
            return satisfies;
        }
        catch (err) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const message = err.code;
            if (message === 'ENOENT' && constants_1.pluginNamePattern.test(moduleName)) {
                winston_1.default.warn(`[meta/dependencies] Bundled plugin ${moduleName} not found, skipping dependency check.`);
                return true;
            }
            throw err;
        }
    });
};
Dependencies.parseModuleData = function (moduleName, pkgData) {
    try {
        pkgData = JSON.parse(pkgData);
    }
    catch (e) {
        winston_1.default.warn(`[${chalk_1.default.red('missing')}] ${chalk_1.default.bold(moduleName)} is a required dependency but could not be found\n`);
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
    const versionOk = !semver_1.default.validRange(packageJSONVersion) ||
        semver_1.default.satisfies(moduleData.version, packageJSONVersion);
    const githubRepo = (moduleData._resolved && moduleData._resolved.includes('//github.com'));
    const satisfies = versionOk || githubRepo;
    if (!satisfies) {
        winston_1.default.warn(`[${chalk_1.default.yellow('outdated')}] ${chalk_1.default.bold(moduleData.name)} installed v${moduleData.version}, package.json requires ${packageJSONVersion}\n`);
        depsOutdated = true;
    }
    return satisfies;
};
