import url from 'url';

import { Request, Response, NextFunction } from 'express';

import plugins from '../plugins';
import meta from '../meta';
import user from '../user';

import { SettingsObject } from '../types';

type Locals = {
    homePageRoute: string;
}

function adminHomePageRoute():string {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return ((meta.config.homePageRoute === 'custom' ? meta.config.homePageCustom : meta.config.homePageRoute) || 'categories').replace(/^\//, '') as string;
}

async function getUserHomeRoute(uid : number) : Promise<string> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const settings : SettingsObject = await user.getSettings(uid) as SettingsObject;
    let route : string = adminHomePageRoute();

    if (settings.homePageRoute !== 'undefined' && settings.homePageRoute !== 'none') {
        route = (settings.homePageRoute || route).replace(/^\/+/, '');
    }

    return route;
}

export async function rewrite(req: Request & { uid: number }, res : Response, next: NextFunction): Promise<void> {
    if (req.path !== '/' && req.path !== '/api/' && req.path !== '/api') {
        return next();
    }

    let route : string = adminHomePageRoute();
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (meta.config.allowUserHomePage) {
        route = await getUserHomeRoute(req.uid);
    }

    let parsedUrl : url.UrlWithParsedQuery;
    try {
        parsedUrl = url.parse(route, true);
    } catch (err : unknown) {
        return next(err);
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

export function pluginHook(req: Request, res : Response<object, Locals>, next: NextFunction):void {
    const hook = `action:homepage.get:${res.locals.homePageRoute}`;

    plugins.hooks.fire(hook, {
        req: req,
        res: res,
        next: next,
    }) as void;
}
