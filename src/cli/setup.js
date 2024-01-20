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
exports.webInstall = exports.setup = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const nconf_1 = __importDefault(require("nconf"));
const web_1 = require("../../install/web");
const install_1 = __importDefault(require("../install"));
const constants_1 = require("../constants");
const build_1 = __importDefault(require("../meta/build"));
const prestart_1 = __importDefault(require("../prestart"));
const package_json_1 = __importDefault(require("../../package.json"));
function setup(initConfig) {
    return __awaiter(this, void 0, void 0, function* () {
        winston_1.default.info('NodeBB Setup Triggered via Command Line');
        console.log(`\nWelcome to NodeBB v${package_json_1.default.version}!`);
        console.log('\nThis looks like a new installation, so you\'ll have to answer a few questions about your environment before we can proceed.');
        console.log('Press enter to accept the default setting (shown in brackets).');
        install_1.default.values = initConfig;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const data = yield install_1.default.setup();
        let configFile = constants_1.paths.config;
        if (nconf_1.default.get('config')) {
            configFile = path_1.default.resolve(constants_1.paths.baseDir, nconf_1.default.get('config'));
        }
        prestart_1.default.loadConfig(configFile);
        if (!nconf_1.default.get('skip-build')) {
            yield build_1.default.buildAll();
        }
        let separator = '     ';
        if (process.stdout.columns > 10) {
            for (let x = 0, cols = process.stdout.columns - 10; x < cols; x += 1) {
                separator += '=';
            }
        }
        console.log(`\n${separator}\n`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (data.hasOwnProperty('password')) {
            console.log('An administrative user was automatically created for you:');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.log(`    Username: ${data.username}`);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.log(`    Password: ${data.password}`);
            console.log('');
        }
        console.log('NodeBB Setup Completed. Run "./nodebb start" to manually start your NodeBB server.');
        // If I am a child process, notify the parent of the returned data before exiting (useful for notifying
        // hosts of auto-generated username/password during headless setups)
        if (process.send) {
            process.send(data);
        }
        process.exit();
    });
}
exports.setup = setup;
exports.webInstall = web_1.install;
