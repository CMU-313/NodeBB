"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const validator_1 = __importDefault(require("validator"));
const slugify_1 = __importDefault(require("../slugify"));
const meta_1 = __importDefault(require("../meta"));
const helpers = {
    try(middleware) {
        return function (req, res, next) {
            try {
                const result = middleware(req, res, next);
                if (result instanceof Promise) {
                    result.then(() => {
                        // Handle successful resolution here, if needed
                    }).catch((err) => {
                        // Error handling
                        next(err);
                    });
                }
            }
            catch (err) {
                next(err);
            }
        };
    },
    buildBodyClass(req, res, templateData) {
        var _a, _b;
        if (!templateData || typeof templateData !== 'object') {
            templateData = {};
        }
        const clean = req.path.replace(/^\/api/, '').replace(/^\/|\/$/g, '');
        const parts = clean.split('/').slice(0, 3);
        parts.forEach((p, index) => {
            try {
                p = (0, slugify_1.default)(decodeURIComponent(p));
            }
            catch (err) {
                const error = err; // Type assertion
                winston_1.default.error(`Error decoding URI: ${p}`);
                winston_1.default.error(error.stack);
                p = '';
            }
            p = validator_1.default.escape(String(p));
            parts[index] = index ? `${parts[0]}-${p}` : `page-${p || 'home'}`;
        });
        if (templateData.template && ((_a = templateData.template) === null || _a === void 0 ? void 0 : _a.topic)) {
            parts.push(`page-topic-category-${templateData.category.cid}`);
            parts.push(`page-topic-category-${(0, slugify_1.default)(templateData.category.name)}`);
        }
        if (Array.isArray(templateData.breadcrumbs)) {
            (_b = templateData.breadcrumbs) === null || _b === void 0 ? void 0 : _b.forEach((crumb) => {
                if (crumb && (crumb === null || crumb === void 0 ? void 0 : crumb.hasOwnProperty('cid'))) {
                    parts.push(`parent-category-${crumb.cid}`);
                }
            });
        }
        parts.push(`page-status-${res.statusCode}`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        parts.push(`theme-${meta_1.default.config['theme:id'].split('-')[2]}`);
        if (req.loggedIn) {
            parts.push('user-loggedin');
        }
        else {
            parts.push('user-guest');
        }
        return parts.join(' ');
    },
};
exports.default = helpers;
