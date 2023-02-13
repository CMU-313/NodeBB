import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import validator from 'validator';
import slugify from '../slugify';
import meta from '../meta';


type template = {
    topic: string;
}

type category = {
    cid: string;
    name: string;
}

type templateData = {
    template: template;
    category: category;
    breadcrumbs: string;

}





export default function (middleware) {
    if (middleware && middleware.constructor && middleware.constructor.name === 'AsyncFunction') {
        return async function (req: Request, res: Response, next: NextFunction) {
            try {
                await middleware(req, res, next);
            } catch (err) {
                next(err);
            }
        };
    }


    return function (req: Request, res: Response, next: NextFunction) {
        try {
            middleware(req, res, next);
        } catch (err) {
            next(err);
        }
    };
}

export function buildBodyClass(req: Request, res: Response, templateData: templateData) {
    const clean = req.path.replace(/^\/api/, '').replace(/^\/|\/$/g, '');
    const parts = clean.split('/').slice(0, 3);
    parts.forEach((p: string, index: number) => {
        try {
            p = slugify(decodeURIComponent(p));
        } catch (err) {
            winston.error(`Error decoding URI: ${p}`);
            winston.error(err.stack);
            p = '';
        }
        p = validator.escape(String(p));
        parts[index] = index ? `${parts[0]}-${p}` : `page-${p || 'home'}`;
    });

    if (templateData.template && templateData.template.topic) {
        parts.push(`page-topic-category-${templateData.category.cid}`);
        parts.push(`page-topic-category-${slugify(templateData.category.name)}`);
    }

    if (Array.isArray(templateData.breadcrumbs)) {
        templateData.breadcrumbs.forEach((crumb) => {
            if (crumb && crumb.hasOwnProperty('cid')) {
                parts.push(`parent-category-${crumb.cid}`);
            }
        });
    }

    parts.push(`page-status-${res.statusCode}`);

    parts.push(`theme-${meta.config['theme:id'].split('-')[2]}`);

    if (req) {
        parts.push('user-loggedin');
    } else {
        parts.push('user-guest');
    }
    return parts.join(' ');
}
