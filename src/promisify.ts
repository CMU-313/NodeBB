
import util from 'util';

interface moduleExport {
    env?: environ;
    extends?: string[];
    ignorePatterns?: string[];
    overrides?: [],
    parser?: string,
    parserOptions?: parseOptions,
    plugins?: string[],
    rules?: rulesDict;
    mode?: string;
    preset?: string;
    testEnvironment?: string;
    function1?: () => Promise<void>;
    function2?: (...args: unknown[]) => void;
}

interface parseOptions {
    ecmaVersion?: string;
    sourceType?: string;
    project?: string[];
}

interface environ {
    es2021?: boolean;
    node?: boolean;
    jest?: boolean;
}

interface rulesDict {
    rule: {(key: string): [str: string, num: number]};
}


export default function (theModule: moduleExport, ignoreKeys: string[]) {
    ignoreKeys = ignoreKeys || [];
    function isCallbackedFunction(func: unknown) {
        if (typeof func !== 'function') {
            return false;
        }
        const str = func.toString().split('\n')[0];
        return str.includes('callback)');
    }

    function isAsyncFunction(fn: unknown) {
        return fn && fn.constructor && fn.constructor.name === 'AsyncFunction';
    }

    // Params are functions that have any possible args and outputs
    function wrapCallback(origFn: (...args: unknown[]) => void, callbackFn: (...args: unknown[]) => void) {
        return async function wrapperCallback(...args: unknown[]) {
            if (args.length && typeof args[args.length - 1] === 'function') {
                const cb = await args.pop() as (arg0: unknown, arg1?: unknown) => void;
                args.push((err, res) => (res !== undefined ? cb(err, res) : cb(err)));
                return callbackFn(...args);
            }
            return origFn(...args);
        };
    }

    // Params are functions that have any possible args and outputs
    function wrapPromise(origFn: (...args: unknown[]) => void, promiseFn: (...args: unknown[]) => void) {
        return function wrapperPromise(...args: unknown[]) {
            if (args.length && typeof args[args.length - 1] === 'function') {
                return origFn(...args);
            }
            return promiseFn(...args);
        };
    }

    function promisifyRecursive(module: moduleExport) {
        if (!module) {
            return;
        }

        const keys = Object.keys(module);
        keys.forEach((key) => {
            if (ignoreKeys.includes(key)) {
                return;
            }
            if (isAsyncFunction(module[key])) {
                module[key] = wrapCallback(module[key], util.callbackify(module[key]));
            } else if (isCallbackedFunction(module[key])) {
                module[key] = wrapPromise(module[key], util.promisify(module[key]));
            } else if (typeof module[key] === 'object') {
                promisifyRecursive(module[key]);
            }
        });
    }
    promisifyRecursive(theModule);
}
