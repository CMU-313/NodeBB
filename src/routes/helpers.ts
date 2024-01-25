import { Request, Response, NextFunction, Router, Handler } from 'express';

import winston from 'winston';
import middleware from '../middleware';
import controllerHelpers from '../controllers/helpers';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

type Controller = Handler | AsyncHandler;

type Args = {
    router: Router;
    verb?: string;
    name: string;
    middlewareDep?: Handler;
    middlewares?: Array<Handler>;
    controller: Controller;
}

export function tryRoute(controller: Controller, handler?: (err: Error, res: Response) => void) : Controller {
    // `handler` is optional
    if (controller && controller.constructor && controller.constructor.name === 'AsyncFunction') {
        return async function (req : Request, res : Response, next : NextFunction) {
            try {
                await controller(req, res, next);
            } catch (err) {
                if (handler) {
                    return handler(err as Error, res);
                }

                next(err);
            }
        };
    }
    return controller;
}

// router, name, middleware(deprecated), middlewares(optional), controller
export function setupPageRoute({ router, name, middlewareDep, middlewares = [], controller } : Args) {
    if (middlewareDep !== undefined) {
        winston.warn(`[helpers.setupPageRoute(${name})] passing \`middleware\` as the third param is deprecated, it can now be safely removed`);
    }

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    middlewares = [
        middleware.authenticateRequest as Handler,
        middleware.maintenanceMode as Handler,
        middleware.registrationComplete as Handler,
        middleware.pluginHooks as Handler,
        ...middlewares,
        middleware.pageView as Handler,
    ];

    router.get(
        name,
        middleware.busyCheck as Handler,
        middlewares,
        middleware.buildHeader as Handler,
        tryRoute(controller) as Handler
    );
    router.get(`/api${name}`, middlewares, tryRoute(controller) as Handler);
}

// router, name, middleware(deprecated), middlewares(optional), controller
export function setupAdminPageRoute({ router, name, middlewareDep, middlewares = [], controller } : Args) {
    if (middlewareDep !== undefined) {
        winston.warn(`[helpers.setupAdminPageRoute(${name})] passing \`middleware\` as the third param is deprecated, it can now be safely removed`);
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    router.get(name, middleware.admin.buildHeader as Handler, middlewares, tryRoute(controller) as Handler);
    router.get(`/api${name}`, middlewares, tryRoute(controller) as Handler);
}

// router, verb, name, middlewares(optional), controller
export function setupApiRoute({ router, verb, name, middlewares = [], controller } : Args) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    middlewares = [
        middleware.authenticateRequest as Handler,
        middleware.maintenanceMode as Handler,
        middleware.registrationComplete as Handler,
        middleware.pluginHooks as Handler,
        ...middlewares,
    ];

    function callTryRoute() {
        tryRoute(controller, (err : Error, res : Response) => {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            controllerHelpers.formatApiResponse(400, res, err) as void;
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
