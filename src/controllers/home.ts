import url from 'url';
import { Request, Response, NextFunction } from 'express';
import { SettingsObject } from '../types';
// import { Url } from 'url';
import plugins from '../plugins';
import meta from '../meta';
import user from '../user';

type urlparse = url.UrlWithParsedQuery;
// type Request = express.Request;
// type Response = express.Response;
// type Next = express.NextFunction;

function adminHomePageRoute() : string {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return <string>((meta.config.homePageRoute === 'custom' ? meta.config.homePageCustom : meta.config.homePageRoute) || 'categories').replace(/^\//, '');
}


async function getUserHomeRoute(uid : number) : Promise<string> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const settings : SettingsObject = <SettingsObject>(await user.getSettings(uid));
    let route = adminHomePageRoute();

    if (settings.homePageRoute !== 'undefined' && settings.homePageRoute !== 'none') {
        route = (settings.homePageRoute || route).replace(/^\/+/, '');
    }

    return route;
}

export async function rewrite(req : Request & SettingsObject, res : Response, next : NextFunction) {
    if (req.path !== '/' && req.path !== '/api/' && req.path !== '/api') {
        return next();
    }
    let route = adminHomePageRoute();
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (<boolean>meta.config.allowUserHomePage) {
        route = await getUserHomeRoute(req.uid);
    }

    let parsedUrl : urlparse;
    try {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        parsedUrl = url.parse(route, true);
    } catch (err) {
        return next(err);
    }

    const { pathname } = parsedUrl;
    const hook = `action:homepage.get:${pathname}`;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (!plugins.hooks.hasListeners(hook)) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        req.url = req.path + (!req.path.endsWith('/') ? '/' : '') + pathname;
    } else {
        res.locals.homePageRoute = pathname;
    }
    req.query = Object.assign(parsedUrl.query, req.query);

    next();
}

interface Rec {
    homePageRoute: string;
}

export async function pluginHook(req: Request, res : Response<unknown, Rec>, next: NextFunction):Promise<void> {
    const hook = `action:homepage.get:${res.locals.homePageRoute}`;

    await plugins.hooks.fire(hook, {
        req: req,
        res: res,
        next: next,
    });
}
