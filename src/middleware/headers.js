"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const configs_1 = __importDefault(require("../meta/configs"));
const helpers_1 = require("./helpers");
const middleware = {
    addHeaders: function (req, res, next) {
        throw new Error('Function not implemented.');
    },
    autoLocale: function (req, res, next) {
        throw new Error('Function not implemented.');
    },
};
const vall = configs_1.default['powered-by'];
const vall1 = configs_1.default['access-control-allow-methods'];
const vall2 = configs_1.default['access-control-allow-headers'];
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
middleware.addHeaders = (0, helpers_1.tryFunc)((req, res, next) => {
    const headers = {
        'X-Powered-By': encodeURI(vall || 'NodeBB'),
        'Access-Control-Allow-Methods': encodeURI(vall1 || ''),
        'Access-Control-Allow-Headers': encodeURI(vall2 || ''),
    };
    if (configs_1.default['csp-frame-ancestors']) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let tmp = headers['Content-Security-Policy'];
        const tmpStr = configs_1.default['csp-frame-ancestors'];
        tmp = `frame-ancestors ${tmpStr}`;
        if (configs_1.default['csp-frame-ancestors'] === '\'none\'') {
            headers['X-Frame-Options'] = 'DENY';
        }
    }
    else {
        headers['Content-Security-Policy'] = 'frame-ancestors \'self\'';
        headers['X-Frame-Options'] = 'SAMEORIGIN';
    }
    if (configs_1.default['access-control-allow-origin']) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const tmpVar = configs_1.default['access-control-allow-origin'];
        let origins = tmpVar.split(',');
        origins = origins.map((origin) => origin && origin.trim());
        if (origins.includes(req.get('origin'))) {
            headers['Access-Control-Allow-Origin'] = encodeURI(req.get('origin'));
            //   headers.Vary = headers.Vary ? `${headers.Vary}, Origin` : 'Origin';
        }
    }
});
if (configs_1.default['access-control-allow-origin-regex']) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const tmpVarr = configs_1.default['access-control-allow-origin-regex'];
    let originsRegex = tmpVarr.split(',');
    originsRegex = originsRegex.map((origin) => {
        try {
            const val = (new RegExp(origin.trim()));
            origin = val;
        }
        catch (err) {
            winston_1.default.error(`[middleware.addHeaders] Invalid RegExp For access-control-allow-origin ${origin}`);
            origin = null;
        }
        return origin;
    });
}
