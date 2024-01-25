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
exports.setupApiRoute = exports.setupAdminPageRoute = exports.setupPageRoute = exports.tryRoute = void 0;
const winston_1 = __importDefault(require("winston"));
const middleware_1 = __importDefault(require("../middleware"));
const helpers_1 = __importDefault(require("../controllers/helpers"));
function tryRoute(controller, handler) {
    // `handler` is optional
    if (controller && controller.constructor && controller.constructor.name === 'AsyncFunction') {
        return function (req, res, next) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    yield controller(req, res, next);
                }
                catch (err) {
                    if (handler) {
                        return handler(err, res);
                    }
                    next(err);
                }
            });
        };
    }
    return controller;
}
exports.tryRoute = tryRoute;
// router, name, middleware(deprecated), middlewares(optional), controller
function setupPageRoute({ router, name, middlewareDep, middlewares = [], controller }) {
    if (middlewareDep !== undefined) {
        winston_1.default.warn(`[helpers.setupPageRoute(${name})] passing \`middleware\` as the third param is deprecated, it can now be safely removed`);
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    middlewares = [
        middleware_1.default.authenticateRequest,
        middleware_1.default.maintenanceMode,
        middleware_1.default.registrationComplete,
        middleware_1.default.pluginHooks,
        ...middlewares,
        middleware_1.default.pageView,
    ];
    router.get(name, middleware_1.default.busyCheck, middlewares, middleware_1.default.buildHeader, tryRoute(controller));
    router.get(`/api${name}`, middlewares, tryRoute(controller));
}
exports.setupPageRoute = setupPageRoute;
// router, name, middleware(deprecated), middlewares(optional), controller
function setupAdminPageRoute({ router, name, middlewareDep, middlewares = [], controller }) {
    if (middlewareDep !== undefined) {
        winston_1.default.warn(`[helpers.setupAdminPageRoute(${name})] passing \`middleware\` as the third param is deprecated, it can now be safely removed`);
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    router.get(name, middleware_1.default.admin.buildHeader, middlewares, tryRoute(controller));
    router.get(`/api${name}`, middlewares, tryRoute(controller));
}
exports.setupAdminPageRoute = setupAdminPageRoute;
// router, verb, name, middlewares(optional), controller
function setupApiRoute({ router, verb, name, middlewares = [], controller }) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    middlewares = [
        middleware_1.default.authenticateRequest,
        middleware_1.default.maintenanceMode,
        middleware_1.default.registrationComplete,
        middleware_1.default.pluginHooks,
        ...middlewares,
    ];
    function callTryRoute() {
        tryRoute(controller, (err, res) => {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            helpers_1.default.formatApiResponse(400, res, err);
        });
    }
    switch (verb) {
        case 'get': {
            router.get(name, middlewares, callTryRoute);
            break;
        }
        case 'head': {
            router.head(name, middlewares, callTryRoute);
            break;
        }
        case 'post': {
            router.post(name, middlewares, callTryRoute);
            break;
        }
        case 'put': {
            router.put(name, middlewares, callTryRoute);
            break;
        }
        case 'delete': {
            router.delete(name, middlewares, callTryRoute);
            break;
        }
    }
}
exports.setupApiRoute = setupApiRoute;
