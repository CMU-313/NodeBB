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
const winston_1 = __importDefault(require("winston"));
const express_1 = require("express");
const meta_1 = __importDefault(require("../../meta"));
const plugins_1 = __importDefault(require("../../plugins"));
const middleware_1 = __importDefault(require("../../middleware"));
const write_1 = __importDefault(require("../../controllers/write"));
const helpers_1 = __importDefault(require("../../controllers/helpers"));
const users_1 = __importDefault(require("./users"));
const groups_1 = __importDefault(require("./groups"));
const Write = {
    reload: (params) => __awaiter(void 0, void 0, void 0, function* () {
        const { router } = params;
        let apiSettings = yield meta_1.default.settings.get('core.api');
        plugins_1.default.hooks.register('core', {
            hook: 'action:settings.set',
            method: (data) => __awaiter(void 0, void 0, void 0, function* () {
                if (data.plugin === 'core.api') {
                    apiSettings = (yield meta_1.default.settings.get('core.api'));
                }
            }),
        });
        router.use('/api/v3', (req, res, next) => {
            const handleAsync = () => __awaiter(void 0, void 0, void 0, function* () {
                if (apiSettings.requireHttps === 'on' && req.protocol !== 'https') {
                    res.set('Upgrade', 'TLS/1.0, HTTP/1.1');
                    yield helpers_1.default.formatApiResponse(426, res);
                    return;
                }
                res.locals.isAPI = true;
            });
            handleAsync()
                .then(() => next())
                .catch(error => next(error));
        });
        router.use('/api/v3/users', (0, users_1.default)());
        router.use('/api/v3/groups', (0, groups_1.default)());
        router.get('/api/v3/ping', write_1.default.utilities.ping.get);
        const pluginRouter = (0, express_1.Router)();
        yield plugins_1.default.hooks.fire('static:api.routes', {
            router: pluginRouter,
            middleware: middleware_1.default,
            helpers: helpers_1.default,
        });
        winston_1.default.info(`[api] Adding ${pluginRouter.stack.length} route(s) to \`api/v3/plugins\``);
        router.use('/api/v3/plugins', pluginRouter);
        router.use('/api/v3', (req, res, next) => {
            helpers_1.default.formatApiResponse(404, res)
                .then(() => next())
                .catch(error => next(error));
        });
    }),
    cleanup: (req, res, next) => {
        if (req.session) {
            req.session.destroy((err) => {
                if (err) {
                    console.error(err);
                    next(err);
                }
                else {
                    next();
                }
            });
        }
        else {
            next();
        }
    },
};
exports.default = Write;
