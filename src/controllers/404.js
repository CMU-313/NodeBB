var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import nconf from 'nconf';
import winston from 'winston';
import validator from 'validator';
import meta from '../meta';
import plugins from '../plugins';
import middleware from '../middleware';
import helpers from '../middleware/helpers';
export default (req, res) => {
    const { num } = req.params;
    export function handle404(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const relativePath = nconf.get('relative_path');
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
            }
            else if (!res.locals.isAPI && (req.path.startsWith(`${relativePath}/assets/uploads`) ||
                (req.get('accept') && !req.get('accept').includes('text/html')) ||
                req.path === '/favicon.ico')) {
                meta.errors.log404(req.path || '');
                res.sendStatus(404);
            }
            else if (req.accepts('html')) {
                if (process.env.NODE_ENV === 'development') {
                    winston.warn(`Route requested but not found: ${req.url}`);
                }
                meta.errors.log404(req.path.replace(/^\/api/, '') || '');
                exports.send404(req, res);
            }
            else {
                res.status(404).type('txt').send('Not found');
            }
        });
    }
    ;
    export function send404(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            res.status(404);
            const path = String(req.path || '');
            if (res.locals.isAPI) {
                return res.json({
                    path: validator.escape(path.replace(/^\/api/, '')),
                    title: '[[global:404.title]]',
                    bodyClass: helpers.buildBodyClass(req, res),
                });
            }
            yield middleware.buildHeaderAsync(req, res);
            yield res.render('404', {
                path: validator.escape(path),
                title: '[[global:404.title]]',
                bodyClass: helpers.buildBodyClass(req, res),
            });
        });
    }
};
