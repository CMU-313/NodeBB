"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const nconf = __importStar(require("nconf"));
const path = __importStar(require("path"));
const winston = __importStar(require("winston"));
const mkdirp = __importStar(require("mkdirp"));
const mime = __importStar(require("mime"));
const graceful = __importStar(require("graceful-fs"));
const meta = require("./meta");
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
graceful.gracefulify(fs);
const file = {
    saveFileToLocal: function (filename, folder, tempPath) {
        return __awaiter(this, void 0, void 0, function* () {
            filename = filename.split('.').map(name => slugify(name)).join('.');
            const uploadPath = path.join(String(nconf.get('upload_path')), String(folder), String(filename));
            if (!uploadPath.startsWith(String(nconf.get('upload_path')))) {
                throw new Error('[[error:invalid-path]]');
            }
            winston.verbose(`Saving file ${filename} to : ${uploadPath}`);
            const dirName = path.dirname(uploadPath);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield mkdirp(dirName);
            yield fs.promises.copyFile(tempPath, uploadPath, null);
            return {
                url: `/assets/uploads/${folder ? `${folder}/` : ''}${filename}`,
                path: uploadPath,
            };
        });
    },
    base64ToLocal: function (imageData, uploadPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = Buffer.from(imageData.slice(imageData.indexOf('base64') + 7), 'base64');
            uploadPath = path.join(String(nconf.get('upload_path')), String(uploadPath));
            yield fs.promises.writeFile(uploadPath, buffer, 'base64');
            return uploadPath;
        });
    },
    appendToFileName: function (filename, string) {
        const dotIndex = filename.lastIndexOf('.');
        if (dotIndex === -1) {
            return filename + string;
        }
        return filename.substring(0, dotIndex) + string + filename.substring(dotIndex);
    },
    allowedExtensions: function () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const allowedFileExtensions = meta.config.allowedFileExtensions.trim();
        if (!allowedFileExtensions) {
            return [];
        }
        let allowedExtensions = allowedFileExtensions.split(',');
        allowedExtensions = allowedExtensions.filter(Boolean).map((extension) => {
            extension = extension.trim();
            if (!extension.startsWith('.')) {
                extension = `.${extension}`;
            }
            return extension.toLowerCase();
        });
        if (allowedExtensions.includes('.jpg') && !allowedExtensions.includes('.jpeg')) {
            allowedExtensions.push('.jpeg');
        }
        return allowedExtensions;
    },
    exists: function (filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield fs.promises.stat(filePath);
            }
            catch (err) {
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                if (err.code === 'ENOENT') {
                    return false;
                }
                throw err;
            }
            return true;
        });
    },
    existsSync: function (filePath) {
        try {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            fs.statSync(filePath);
        }
        catch (err) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (err.code === 'ENOENT') {
                return false;
            }
            throw err;
        }
        return true;
    },
    delete: function (filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!filePath) {
                return;
            }
            try {
                yield fs.promises.unlink(filePath);
            }
            catch (err) {
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                if (err.code === 'ENOENT') {
                    winston.verbose(`[file] Attempted to delete non-existent file: ${filePath}`);
                    return;
                }
                winston.warn(err);
            }
        });
    },
    link: function link(filePath, destPath, relative) {
        return __awaiter(this, void 0, void 0, function* () {
            if (relative && process.platform !== 'win32') {
                filePath = path.relative(path.dirname(destPath), filePath);
            }
            if (process.platform === 'win32') {
                yield fs.promises.link(filePath, destPath);
            }
            else {
                yield fs.promises.symlink(filePath, destPath, 'file');
            }
        });
    },
    linkDirs: function linkDirs(sourceDir, destDir, relative) {
        return __awaiter(this, void 0, void 0, function* () {
            if (relative && process.platform !== 'win32') {
                sourceDir = path.relative(path.dirname(destDir), sourceDir);
            }
            const type = (process.platform === 'win32') ? 'junction' : 'dir';
            yield fs.promises.symlink(sourceDir, destDir, type);
        });
    },
    typeToExtension: function (type) {
        let extension = '';
        if (type) {
            extension = `.${mime.extension(type)}`;
        }
        return extension;
    },
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    walk: function (dir) {
        return __awaiter(this, void 0, void 0, function* () {
            const subdirs = yield fs.promises.readdir(dir);
            const files = yield Promise.all(subdirs.map((subdir) => __awaiter(this, void 0, void 0, function* () {
                const res = path.resolve(dir, subdir);
                return (yield fs.promises.stat(res)).isDirectory() ? file.walk(res) : res;
            })));
            return files.reduce((a, f) => a.concat(String(f)), []);
        });
    },
};
/* require('./promisify')(file); */
