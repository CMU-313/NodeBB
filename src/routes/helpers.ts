
import { Router, Request, Response } from 'express';
import winston from 'winston';
import middleware from '../middleware';
import controllerHelpers from '../controllers/helpers';

// The next line calls controller and handler that has not been updated to TS yet
// eslint-disable-next-line
export function tryRoute(controller, handler?) {
    // `handler` is optional
    // The next line calls controller has not been updated to TS yet
    // eslint-disable-next-line
    if (controller && controller.constructor && controller.constructor.name === 'AsyncFunction') {
        // The next line calls next that has not been updated to TS yet
        // eslint-disable-next-line
        return async function (req:Request, res:Response, next) {
            try {
                // The next line calls controller and handler that has not been updated to TS yet
                // eslint-disable-next-line
                await controller(req, res, next);
            } catch (err:unknown) {
                // The next line calls handler that has not been updated to TS yet
                // eslint-disable-next-line
                if (handler) {
                    // The next line calls handler that has not been updated to TS yet
                    // eslint-disable-next-line
                    return handler(err, res);
                }
                // The next line calls next that has not been updated to TS yet
                // eslint-disable-next-line
                next(err);
            }
        };
    }
    // The next line calls controller that has not been updated to TS yet
    // eslint-disable-next-line
    return controller;
}



// router, name, middleware(deprecated), middlewares(optional), controller

// The next line calls middleware, middlewares and controller that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
export function setupPageRoute(router:Router, name:string, middleware, middlewares, controller) {
    // The next line calls  middlewares that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (middlewares) {
        winston.warn(`[helpers.setupPageRoute(${name})] passing \`middleware\` as the third param is deprecated, it can now be safely removed`);
    }
    // The next lines calls  middlewares that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    middlewares = [middleware.authenticateRequest, middleware.maintenanceMode,
        // eslint-disable-next-line
        middleware.registrationComplete, middleware.pluginHooks, middlewares, middleware.pageView];
    // The next line calls  middlewares and middleware that has not been updated to TS yet
    // eslint-disable-next-line
    router.get(name, middleware.busyCheck, middlewares, middleware.buildHeader, tryRoute(controller));
    // The next line calls  middlewares and controller that has not been updated to TS yet
    // eslint-disable-next-line
    router.get(`/api${name}`, middlewares, tryRoute(controller));
}

// router, name, middleware(deprecated), middlewares(optional), controller
export function setupAdminPageRoute(router:Router, name:string, middleware, middlewares, controller) {
    // The next line calls  middlewares and controller that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (middlewares) {
        winston.warn(`[helpers.setupPageRoute(${name})] passing \`middleware\` as the third param is deprecated, it can now be safely removed`);
    }
    // The next line calls middlewares and middleware that has not been updated to TS yet
    // eslint-disable-next-line
    router.get(name, middleware.admin.buildHeader, middlewares, tryRoute(controller));
    // The next line calls  middlewares that has not been updated to TS yet
    // eslint-disable-next-line
    router.get(`/api${name}`, middlewares, tryRoute(controller));
}

// router, verb, name, middlewares(optional), controller

// The next line calls  middlewares and controller that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
export function setupApiRoute(router:Router, verb:string, name:string, middlewares, controller) {
    // The next line calls  middleware that has not been updated to TS yet
    // eslint-disable-next-line
    middlewares = [ middleware.authenticateRequest, middleware.maintenanceMode,
        // The next line calls  middlewares that has not been updated to TS yet
        // eslint-disable-next-line
        middleware.registrationComplete, middleware.pluginHooks, middlewares];
    // The next line calls  middlewares, controller that has not been updated to TS yet
    // eslint-disable-next-line
    router[verb](name, middlewares, tryRoute(controller, (err, res) => {controllerHelpers.formatApiResponse(400, res, err);
    }));
}

