import nconf from 'nconf';
import winston from 'winston';
import validator from 'validator';

import { Request, Response } from 'express';

import meta from '../meta';
import plugins from '../plugins';
import middleware from '../middleware';
import helpers from '../middleware/helpers';

export async function handle404(req: Request, res: Response) {
    const relativePath = nconf.get('relative_path') as string;
    const isClientScript = new RegExp(`^${relativePath}\\/assets\\/src\\/.+\\.js(\\?v=\\w+)?$`);

    if (plugins.hooks.hasListeners('action:meta.override404')) {
        return plugins.hooks.fire('action:meta.override404', {
            req: req,
            res: res,
            error: {},
        });
    }

    if (isClientScript.test(req.url)) {
        res.type('text/javascript').status(404).send('Not Found');
    } else if (
        !res.locals.isAPI && (
            req.path.startsWith(`${relativePath}/assets/uploads`) ||
            (req.get('accept') && !req.get('accept').includes('text/html')) ||
            req.path === '/favicon.ico'
        )
    ) {
        meta.errors.log404(req.path || '');
        res.sendStatus(404);
    } else if (req.accepts('html')) {
        if (process.env.NODE_ENV === 'development') {
            winston.warn(`Route requested but not found: ${req.url}`);
        }

        meta.errors.log404(req.path.replace(/^\/api/, '') || '');
    } else {
        res.status(404).type('txt').send('Not found');
    }
}

export async function send404(req: Request, res: Response): Promise<Response> {
    res.status(404);
    const path = String(req.path || '');
    if (res.locals.isAPI) {
        return res.json({
            path: validator.escape(path.replace(/^\/api/, '')),
            title: '[[global:404.title]]',
            bodyClass: helpers.buildBodyClass(req, res) as string[],
        });
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await middleware.buildHeaderAsync(req, res);
    res.render('404', {
        path: validator.escape(path),
        title: '[[global:404.title]]',
        bodyClass: helpers.buildBodyClass(req, res) as string[],
    });
}
