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
Object.defineProperty(exports, "__esModule", { value: true });
const url = require("url");
const plugins = require("../plugins");
const meta = require("../meta");
const user = require("../user");
function adminHomePageRoute() {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return ((meta.config.homePageRoute === 'custom' ? meta.config.homePageCustom : meta.config.homePageRoute) || 'categories').replace(/^\//, '');
}
function getUserHomeRoute(uid) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const settings = yield user.getSettings(uid);
        let route = adminHomePageRoute();
        if (settings.homePageRoute !== 'undefined' && settings.homePageRoute !== 'none') {
            route = (settings.homePageRoute || route).replace(/^\/+/, '');
        }
        return route;
    });
}
function rewrite(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.path !== '/' && req.path !== '/api/' && req.path !== '/api') {
            return next();
        }
        let route = adminHomePageRoute();
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (meta.config.allowUserHomePage) {
            route = yield getUserHomeRoute(req.uid);
        }
        let parsedUrl;
        try {
            parsedUrl = url.parse(route, true);
        }
        catch (err) {
            return next(err);
        }
        const { pathname } = parsedUrl;
        const hook = `action:homepage.get:${pathname}`;
        if (!plugins.hooks.hasListeners(hook)) {
            req.url = req.path + (!req.path.endsWith('/') ? '/' : '') + pathname;
        }
        else {
            res.locals.homePageRoute = pathname;
        }
        req.query = Object.assign(parsedUrl.query, req.query);
        next();
    });
}
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
exports.rewrite = rewrite;
function pluginHook(req, res, next) {
    const hook = `action:homepage.get:${res.locals.homePageRoute}`;
    plugins.hooks.fire(hook, {
        req: req,
        res: res,
        next: next,
    }).catch(e => console.error(e));
}
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
exports.pluginHook = pluginHook;
