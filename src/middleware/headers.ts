import os from 'os';
import winston from 'winston';
import _ from 'lodash';

import meta from '../meta';
import metaConfig from '../meta/configs';
import languages from '../languages';
import { tryFunc } from './helpers';
import plugins from '../plugins';

interface Request {
  get: (property: string) => string | undefined
  query: { lang?: string }
  acceptsLanguages: (languages: string[]) => string | false
  uid: number
}

interface Response {
  setHeader: (key: string, value: string) => void
}

interface NextFunction {
  (): void
}

interface Middleware {
  addHeaders: (req: Request, res: Response, next: NextFunction) => void
  autoLocale: (req: Request, res: Response, next: NextFunction) => void | Promise<void>
}

const middleware: Middleware = {
    addHeaders: function (req: Request, res: Response, next: NextFunction): void {
        throw new Error('Function not implemented.');
    },
    autoLocale: function (req: Request, res: Response, next: NextFunction): void | Promise<void> {
        throw new Error('Function not implemented.');
    },
};

const vall : string = <string> metaConfig['powered-by'];
const vall1 : string = <string> metaConfig['access-control-allow-methods'];
const vall2 : string = <string> metaConfig['access-control-allow-headers'];
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
middleware.addHeaders = (req: Request, res: Response, next: NextFunction) => {
    const headers = {
        'X-Powered-By': encodeURI(vall || 'NodeBB'),
        'Access-Control-Allow-Methods': encodeURI(vall1 || ''),
        'Access-Control-Allow-Headers': encodeURI(vall2 || ''),
    };

    if (metaConfig['csp-frame-ancestors']) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let tmp : string = <string> headers['Content-Security-Policy'];
        const tmpStr : string = <string> metaConfig['csp-frame-ancestors'];
        tmp = `frame-ancestors ${tmpStr}`;
        if (metaConfig['csp-frame-ancestors'] === '\'none\'') {
            headers['X-Frame-Options'] = 'DENY';
        }
    } else {
        headers['Content-Security-Policy'] = 'frame-ancestors \'self\'';
        headers['X-Frame-Options'] = 'SAMEORIGIN';
    }

    if (metaConfig['access-control-allow-origin']) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const tmpVar : string = <string> metaConfig['access-control-allow-origin'];
        let origins : string[] = tmpVar.split(',');
        origins = origins.map((origin: string) => origin && origin.trim());

        if (origins.includes(req.get('origin'))) {
            headers['Access-Control-Allow-Origin'] = encodeURI(req.get('origin'));
        }
    }
};


if (metaConfig['access-control-allow-origin-regex']) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const tmpVarr = <string> metaConfig['access-control-allow-origin-regex'];
    let originsRegex : string[] = tmpVarr.split(',');
    originsRegex = originsRegex.map((origin: string) => {
        try {
            const val : string = <string> <unknown>(new RegExp(origin.trim()));
            origin = val;
        } catch (err) {
            winston.error(`[middleware.addHeaders] Invalid RegExp For access-control-allow-origin ${origin}`);
            origin = null;
        }
        return origin;
    });
}
