import winston from 'winston';
import { Router, Request, Response, NextFunction } from 'express';
import meta from '../../meta';
import plugins from '../../plugins';
import middleware from '../../middleware';
import writeControllers from '../../controllers/write';
import helpers from '../../controllers/helpers';

import usersRoute from './users';
import groupsRoute from './groups';

interface WriteParams {
  router: Router;
}

interface ApiSettings {
  requireHttps: 'on' | 'off';
}

const Write = {
    reload: async (params: WriteParams): Promise<void> => {
        const { router } = params;
        let apiSettings: ApiSettings = await meta.settings.get('core.api') as ApiSettings;

        plugins.hooks.register('core', {
            hook: 'action:settings.set',
            method: async (data: { plugin: string }) => {
                if (data.plugin === 'core.api') {
                    apiSettings = await meta.settings.get('core.api') as ApiSettings;
                }
            },
        });

        router.use('/api/v3', (req, res, next) => {
            const handleAsync = async () => {
                if (apiSettings.requireHttps === 'on' && req.protocol !== 'https') {
                    res.set('Upgrade', 'TLS/1.0, HTTP/1.1');
                    await helpers.formatApiResponse(426, res);
                    return;
                }
                res.locals.isAPI = true;
            };

            handleAsync()
                .then(() => next())
                .catch(error => next(error));
        });

        router.use('/api/v3/users', usersRoute());
        router.use('/api/v3/groups', groupsRoute());
        router.get('/api/v3/ping', writeControllers.utilities.ping.get);

        const pluginRouter = Router();
        await plugins.hooks.fire('static:api.routes', {
            router: pluginRouter,
            middleware,
            helpers,
        });

        winston.info(`[api] Adding ${pluginRouter.stack.length} route(s) to \`api/v3/plugins\``);
        router.use('/api/v3/plugins', pluginRouter);

        router.use('/api/v3', (req, res, next) => {
            helpers.formatApiResponse(404, res)
                .then(() => next())
                .catch(error => next(error));
        });
    },

    cleanup: (req: Request, res: Response, next: NextFunction): void => {
        if (req.session) {
            req.session.destroy((err) => {
                if (err) {
                    console.error(err);
                    next(err);
                } else {
                    next();
                }
            });
        } else {
            next();
        }
    },
};

export default Write;


