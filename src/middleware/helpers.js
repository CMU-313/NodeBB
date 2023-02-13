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
exports.buildBodyClass = void 0;
const winston_1 = __importDefault(require("winston"));
const validator_1 = __importDefault(require("validator"));
const slugify_1 = __importDefault(require("../slugify"));
const meta_1 = __importDefault(require("../meta"));
function default_1(middleware) {
    if (middleware && middleware.constructor && middleware.constructor.name === 'AsyncFunction') {
        return function (req, res, next) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    yield middleware(req, res, next);
                }
                catch (err) {
                    next(err);
                }
            });
        };
    }
    return function (req, res, next) {
        try {
            middleware(req, res, next);
        }
        catch (err) {
            next(err);
        }
    };
}
exports.default = default_1;
function buildBodyClass(req, res, templateData) {
    const clean = req.path.replace(/^\/api/, '').replace(/^\/|\/$/g, '');
    const parts = clean.split('/').slice(0, 3);
    parts.forEach((p, index) => {
        try {
            p = (0, slugify_1.default)(decodeURIComponent(p));
        }
        catch (err) {
            winston_1.default.error(`Error decoding URI: ${p}`);
            winston_1.default.error(err.stack);
            p = '';
        }
        p = validator_1.default.escape(String(p));
        parts[index] = index ? `${parts[0]}-${p}` : `page-${p || 'home'}`;
    });
    if (templateData.template && templateData.template.topic) {
        parts.push(`page-topic-category-${templateData.category.cid}`);
        parts.push(`page-topic-category-${(0, slugify_1.default)(templateData.category.name)}`);
    }
    if (Array.isArray(templateData.breadcrumbs)) {
        templateData.breadcrumbs.forEach((crumb) => {
            if (crumb && crumb.hasOwnProperty('cid')) {
                parts.push(`parent-category-${crumb.cid}`);
            }
        });
    }
    parts.push(`page-status-${res.statusCode}`);
    parts.push(`theme-${meta_1.default.config['theme:id'].split('-')[2]}`);
    if (req) {
        parts.push('user-loggedin');
    }
    else {
        parts.push('user-guest');
    }
    return parts.join(' ');
}
exports.buildBodyClass = buildBodyClass;
