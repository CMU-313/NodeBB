import url = require('url');

import plugins = require('../plugins');
import meta = require('../meta');
import user = require('../user');

interface Setting {
    homePageRoute : string;
}

interface Req {
    path : string;
    uid : string;
    url : string;
    query : string;
    pathname : string;
}

type Next = (a : string | void) => unknown;

interface ParsedUrl {
    pathname : string;
    query : unknown;
}

interface Locals {
    homePageRoute : string;
}

interface Res {
    locals : Locals;
}

function adminHomePageRoute() {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return ((meta.config.homePageRoute === 'custom' ? meta.config.homePageCustom : meta.config.homePageRoute) || 'categories').replace(/^\//, '') as string;
}

async function getUserHomeRoute(uid : string) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const settings : Setting = await user.getSettings(uid) as Setting;
    let route : string = adminHomePageRoute();

    if (settings.homePageRoute !== 'undefined' && settings.homePageRoute !== 'none') {
        route = (settings.homePageRoute || route).replace(/^\/+/, '');
    }

    return route;
}

async function rewrite(req : Req, res : Res, next : Next) {
    if (req.path !== '/' && req.path !== '/api/' && req.path !== '/api') {
        return next();
    }
    let route = adminHomePageRoute();
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (meta.config.allowUserHomePage) {
        route = await getUserHomeRoute(req.uid);
    }

    let parsedUrl : ParsedUrl;
    try {
        parsedUrl = url.parse(route, true);
    } catch (err) {
        return next(err as string);
    }

    const { pathname } = parsedUrl;
    const hook = `action:homepage.get:${pathname}`;
    if (!plugins.hooks.hasListeners(hook)) {
        req.url = req.path + (!req.path.endsWith('/') ? '/' : '') + pathname;
    } else {
        res.locals.homePageRoute = pathname;
    }
    req.query = Object.assign(parsedUrl.query, req.query);

    next();
}

// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
exports.rewrite = rewrite;

function pluginHook(req : Req, res : Res, next : Next) {
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
