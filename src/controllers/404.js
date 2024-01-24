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
exports.send404 = exports.handle404 = void 0;
const nconf_1 = __importDefault(require("nconf"));
const winston_1 = __importDefault(require("winston"));
const validator_1 = __importDefault(require("validator"));
const meta_1 = __importDefault(require("../meta"));
const plugins_1 = __importDefault(require("../plugins"));
const middleware_1 = __importDefault(require("../middleware"));
const helpers_1 = __importDefault(require("../middleware/helpers"));
function handle404(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const relativePath = nconf_1.default.get('relative_path');
        const isClientScript = new RegExp(`^${relativePath}\\/assets\\/src\\/.+\\.js(\\?v=\\w+)?$`);
        if (plugins_1.default.hooks.hasListeners('action:meta.override404')) {
            return plugins_1.default.hooks.fire('action:meta.override404', {
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
            meta_1.default.errors.log404(req.path || '');
            res.sendStatus(404);
        }
        else if (req.accepts('html')) {
            if (process.env.NODE_ENV === 'development') {
                winston_1.default.warn(`Route requested but not found: ${req.url}`);
            }
            meta_1.default.errors.log404(req.path.replace(/^\/api/, '') || '');
        }
        else {
            res.status(404).type('txt').send('Not found');
        }
    });
}
exports.handle404 = handle404;
function send404(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        res.status(404);
        const path = String(req.path || '');
        if (res.locals.isAPI) {
            return res.json({
                path: validator_1.default.escape(path.replace(/^\/api/, '')),
                title: '[[global:404.title]]',
                bodyClass: helpers_1.default.buildBodyClass(req, res),
            });
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield middleware_1.default.buildHeaderAsync(req, res);
        res.render('404', {
            path: validator_1.default.escape(path),
            title: '[[global:404.title]]',
            bodyClass: helpers_1.default.buildBodyClass(req, res),
        });
    });
}
exports.send404 = send404;
