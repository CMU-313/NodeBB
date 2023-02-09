"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const nconf_1 = __importDefault(require("nconf"));
const chalk_1 = __importDefault(require("chalk"));
const packageInstall = __importStar(require("./package-install"));
const upgrade_plugins_1 = require("./upgrade-plugins");
const steps = {
    package: {
        message: 'Updating package.json file with defaults...',
        handler: function () {
            packageInstall.updatePackageFile();
            packageInstall.preserveExtraneousPlugins();
            process.stdout.write(chalk_1.default.green(' OK\n'));
        },
    },
    install: {
        message: 'Bringing base dependencies up to date...',
        handler: function () {
            process.stdout.write(chalk_1.default.green(' started\n'));
            packageInstall.installAll();
        },
    },
    plugins: {
        message: 'Checking installed plugins for updates...',
        handler: function () {
            return __awaiter(this, void 0, void 0, function* () {
                // await import('../database').then(mod => mod.init());
                yield (0, upgrade_plugins_1.upgradePlugins)();
            });
        },
    },
    schema: {
        message: 'Updating NodeBB data store schema...',
        handler: function () {
            return __awaiter(this, void 0, void 0, function* () {
                // await import('../database').then(mod => mod.init());
                // await import('../meta').then(mod => mod.configs.init());
                // await import('../upgrade').then(mod => mod.run());
            });
        },
    },
    build: {
        message: 'Rebuilding assets...',
        handler: function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield Promise.resolve().then(() => __importStar(require('../meta/build'))).then(mod => mod.buildAll());
            });
        },
    },
};
function runSteps(tasks) {
    return __awaiter(this, void 0, void 0, function* () {
        /*     try { */
        for (let i = 0; i < tasks.length; i++) {
            /* const step = steps[tasks[i]];
            const m = step.message; */
            if (steps[tasks[i]] /* && m && step.handler */) {
                process.stdout.write(`\n${chalk_1.default.bold(`${i + 1}. `)}`);
                /* eslint-disable-next-line */
                yield steps[tasks[i]].handler();
            }
        }
        const message = 'NodeBB Upgrade Complete!';
        // some consoles will return undefined/zero columns,
        // so just use 2 spaces in upgrade script if we can't get our column count
        const { columns } = process.stdout;
        const spaces = columns ? new Array(Math.floor(columns / 2) - (message.length / 2) + 1).join(' ') : ' ';
        console.log(`\n\n${spaces}${chalk_1.default.green.bold(message)}\n`);
        process.exit();
        /*     } catch (err) {
                //console.error(`Error occurred during upgrade: ${err.stack}`);
                throw err;
            } */
    });
}
function runUpgrade(upgrades, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(chalk_1.default.cyan('\nUpdating NodeBB...'));
        // disable mongo timeouts during upgrade
        nconf_1.default.set('mongo:options:socketTimeoutMS', 0);
        if (upgrades === true) {
            let tasks = Object.keys(steps);
            if (options.package || options.install ||
                options.plugins || options.schema || options.build) {
                tasks = tasks.filter(key => options[key]);
            }
            yield runSteps(tasks);
            return;
        }
        // await require('../database').init();
        // await require('../meta').configs.init();
        // await require('../upgrade').runParticular(upgrades);
        process.exit(0);
    });
}
exports.default = runUpgrade;
