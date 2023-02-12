/* eslint-disable import/no-import-module-exports */
import fs from 'fs';
import nconf from 'nconf';
import path from 'path';
import winston from 'winston';
import mkdirp from 'mkdirp';
import mime from 'mime';
import graceful from 'graceful-fs';
// import { ErrnoException } from 'node';
// import { promisify } from 'util';
/* eslint-enable import/no-import-module-exports */

// These files are not converted to TypeScript yet
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires */
const slugify = require('./slugify');
const promisify = require('./promisify');
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires */

graceful.gracefulify(fs);



const file = {
    saveFileToLocal: function (
        filename: string,
        folder: string,
        tempPath: string,
        callback?: (err: null | Error, data: { url: string, path: string }) => void
    ):
        Promise<{ url: string, path: string } | Error> {
        // slugify is not converted to TypeScript yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
        filename = filename.split('.').map(name => slugify(name)).join('.');
        // nconf.get defines the return type to be any
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const uploadPath: string = path.join(nconf.get('upload_path'), folder, filename);
        // nconf.get defines the return type to be any
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (!uploadPath.startsWith(nconf.get('upload_path'))) {
            if (callback) {
                callback(new Error('[[error:invalid-path]]'), null);
            }
            return Promise.reject(new Error('[[error:invalid-path]]'));
        }
        winston.verbose(`Saving file ${filename} to : ${uploadPath}`);
        return mkdirp(path.dirname(uploadPath))
            .then(() => fs.promises.copyFile(tempPath, uploadPath))
            .then(() => {
                const result = {
                    url: `/assets/uploads/${folder ? `${folder}/` : ''}${filename}`,
                    path: uploadPath,
                };
                if (callback) {
                    callback(null, result);
                    return Promise.resolve(result);
                }
            }).catch((err: Error) => {
                if (callback) {
                    callback(err, null);
                    return Promise.reject(err);
                }
            });
    },


    base64ToLocal: function (
        imageData: string,
        uploadPath: string,
        callback?: (err: NodeJS.ErrnoException | null, result?: string) => void
    ): Promise<string> {
        const buffer = Buffer.from(imageData.slice(imageData.indexOf('base64') + 7), 'base64');
        // nconf.get defines the return type to be any
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        uploadPath = path.join(nconf.get('upload_path'), uploadPath);
        const promise = fs.promises.writeFile(uploadPath, buffer, {
            encoding: 'base64',
        }).then(() => uploadPath);
        if (callback) {
            promise
                .then((result) => {
                    callback(null, result);
                })
                .catch((err: Error) => {
                    callback(err);
                });
        }
        return promise;
    },


    // https://stackoverflow.com/a/31205878/583363
    appendToFileName: function (filename: string, string: string) {
        const dotIndex = filename.lastIndexOf('.');
        if (dotIndex === -1) {
            return filename + string;
        }
        return filename.substring(0, dotIndex) + string + filename.substring(dotIndex);
    },

    allowedExtensions: function () {
        // These files are not converted to TypeScript yet
        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires */
        const meta = require('./meta'); // ./meta must be reimported every time this function runs.
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires */
        // meta is not converted to TypeScript yet
        /* eslint-disable @typescript-eslint/no-unsafe-member-access,
        @typescript-eslint/no-unsafe-assignment,  @typescript-eslint/no-unsafe-call */
        const allowedExtensions: string = (meta.config.allowedFileExtensions || '').trim();
        if (!allowedExtensions) {
            return [];
        }
        /* eslint-enable @typescript-eslint/no-unsafe-member-access,
        @typescript-eslint/no-unsafe-assignment,  @typescript-eslint/no-unsafe-call */

        let allowedExtensionsArr = allowedExtensions.split(',');
        allowedExtensionsArr = allowedExtensionsArr.filter(Boolean).map((extension) => {
            extension = extension.trim();
            if (!extension.startsWith('.')) {
                extension = `.${extension}`;
            }
            return extension.toLowerCase();
        });

        if (allowedExtensionsArr.includes('.jpg') && !allowedExtensionsArr.includes('.jpeg')) {
            allowedExtensionsArr.push('.jpeg');
        }

        return allowedExtensionsArr;
    },

    exists: function (path: string, ...callbacks: ((err: NodeJS.ErrnoException | null, exists: boolean) => void)[]) {
        callbacks = callbacks.filter(cb => typeof cb === 'function');
        const callback = callbacks.length > 0 ? callbacks[0] : null;
        return fs.promises.stat(path).then(() => {
            if (callback && typeof callback === 'function') {
                callback(null, true);
            }
            return true;
        }).catch((err: NodeJS.ErrnoException) => {
            if (err.code === 'ENOENT') {
                if (callback && typeof callback === 'function') {
                    callback(null, false);
                }
                return false;
            }
            if (callback && typeof callback === 'function') {
                callback(err, false);
            }
            throw err;
        });
    },

    existsSync: function (filePath: string) {
        try {
            fs.statSync(filePath);
        } catch (err: unknown) {
            return false;
        }
        return true;
    },

    delete: function (path: string) {
        if (!path) {
            return;
        }
        return fs.promises.unlink(path).catch((err: NodeJS.ErrnoException) => {
            if (err.code === 'ENOENT') {
                winston.verbose(`[file] Attempted to delete non-existent file: ${path}`);
                return;
            }
            winston.warn(err);
            throw err;
        });
    },
    link: function (
        filePath: string,
        destPath: string,
        relative: boolean,
        callback?: (err: NodeJS.ErrnoException | null) => void
    ): Promise<void> {
        if (relative && process.platform !== 'win32') {
            filePath = path.relative(path.dirname(destPath), filePath);
        }

        let promise: Promise<void>;
        if (process.platform === 'win32') {
            promise = fs.promises.link(filePath, destPath);
        } else {
            promise = fs.promises.symlink(filePath, destPath, 'file');
        }

        if (callback) {
            promise
                .then(() => {
                    callback(null);
                })
                .catch((err: NodeJS.ErrnoException) => {
                    callback(err);
                });
        }
        return promise;
    },

    linkDirs: function (
        sourceDir: string,
        destDir: string,
        relative: boolean,
        callback?: (err: NodeJS.ErrnoException | null) => void
    ): Promise<void> {
        if (relative && process.platform !== 'win32') {
            sourceDir = path.relative(path.dirname(destDir), sourceDir);
        }

        const type = (process.platform === 'win32') ? 'junction' : 'dir';
        const promise = fs.promises.symlink(sourceDir, destDir, type);

        if (callback) {
            promise
                .then(() => {
                    callback(null);
                })
                .catch((err: NodeJS.ErrnoException) => {
                    callback(err);
                });
        }
        return promise;
    },


    typeToExtension: function (type: string) {
        let extension = '';
        if (type) {
            extension = `.${mime.getExtension(type)}`;
        }
        return extension;
    },

    // Adapted from http://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
    walk: function (dir: string, callback: (err: Error | null, result: string[] | null) => void):
        Promise<string[] | void> {
        function walkHelper(dir: string): Promise<string[]> {
            return new Promise((resolve, reject) => {
                fs.promises.readdir(dir)
                    .then((subdirs: string[]) => Promise.all(subdirs.map((subdir: string) => {
                        const res: string = path.resolve(dir, subdir);
                        return fs.promises.stat(res)
                            .then((stat: fs.Stats) => (stat.isDirectory() ? walkHelper(res) : [res]));
                    }))).then((files: (string | string[])[]) => {
                        resolve(files.flat());
                    }).catch((error: Error) => {
                        reject(error);
                    });
            });
        }
        const promise: Promise<string[]> = walkHelper(dir);

        if (callback) {
            return promise.then((files: string[]) => {
                callback(null, files);
            }).catch((error: Error) => {
                callback(error, null);
            });
        }
        return promise;
    },
};

// promisify is not converted to TypeScript yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
promisify(file);
export = file;

