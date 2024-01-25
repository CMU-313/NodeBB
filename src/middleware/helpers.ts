import winston from 'winston';
import validator from 'validator';
import { Request, Response, NextFunction } from 'express';
import slugify from '../slugify';
import meta from '../meta';

interface Breadcrumb {
    cid?: string | number;
}

interface TemplateData {
    breadcrumbs?: Breadcrumb[];
    // Include other properties of templateData here
    template?: {
        topic?: string; // Replace 'any' with a more specific type if known
    };
    category?: {
        cid: string | number;
        name: string;
    };
}

interface CustomRequest extends Request {
    loggedIn?: boolean; // Assuming loggedIn is a boolean
    // Add any other custom properties here
}

const helpers = {
    try(middleware: (req: Request, res: Response, next: NextFunction) => Promise<void> | void):
    (req: Request, res: Response, next: NextFunction) => Promise<void>|void {
        return function (req: Request, res: Response, next: NextFunction): void {
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
            } catch (err) {
                next(err);
            }
        };
    },

    buildBodyClass(req: CustomRequest, res: Response, templateData: TemplateData): string {
        if (!templateData || typeof templateData !== 'object') {
            templateData = {};
        }
        const clean = req.path.replace(/^\/api/, '').replace(/^\/|\/$/g, '');
        const parts = clean.split('/').slice(0, 3);
        parts.forEach((p: string, index) => {
            try {
                p = slugify(decodeURIComponent(p)) as string;
            } catch (err) {
                const error = err as Error; // Type assertion
                winston.error(`Error decoding URI: ${p}`);
                winston.error(error.stack);
                p = '';
            }
            p = validator.escape(String(p));
            parts[index] = index ? `${parts[0]}-${p}` : `page-${p || 'home'}`;
        });

        if (templateData.template && templateData.template?.topic) {
            parts.push(`page-topic-category-${templateData.category.cid}`);
            parts.push(`page-topic-category-${slugify(templateData.category.name) as string}`);
        }
        if (Array.isArray(templateData.breadcrumbs)) {
            templateData.breadcrumbs?.forEach((crumb) => {
                if (crumb && crumb?.hasOwnProperty('cid')) {
                    parts.push(`parent-category-${crumb.cid}`);
                }
            });
        }
        parts.push(`page-status-${res.statusCode}`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        parts.push(`theme-${meta.config['theme:id'].split('-')[2] as string}`);
        if (req.loggedIn) {
            parts.push('user-loggedin');
        } else {
            parts.push('user-guest');
        }

        return parts.join(' ');
    },
};

export default helpers;
