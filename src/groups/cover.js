'use strict';
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
const path_1 = __importDefault(require("path"));
const nconf_1 = __importDefault(require("nconf"));
const database_1 = __importDefault(require("../database"));
const image_1 = __importDefault(require("../image"));
const file_1 = __importDefault(require("../file"));
function default_1(Groups) {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/bmp'];
    Groups.updateCoverPosition = function (groupName, position) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!groupName) {
                throw new Error('[[error:invalid-data]]');
            }
            yield Groups.setGroupField(groupName, 'cover:position', position);
        });
    };
    Groups.updateCover = function (uid, data) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            let tempPath = data.file ? data.file.path : '';
            try {
                if (!data.imageData && !data.file && data.position) {
                    yield Groups.updateCoverPosition(data.groupName, data.position);
                    return { url: '' }; // Return a default or placeholder URL
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const s = image_1.default.mimeFromBase64(data.imageData);
                const type = (_b = (_a = data.file) === null || _a === void 0 ? void 0 : _a.mimetype) !== null && _b !== void 0 ? _b : s;
                if (!type || !allowedTypes.includes(type)) {
                    throw new Error('[[error:invalid-image]]');
                }
                if (!tempPath) {
                    tempPath = yield image_1.default.writeImageDataToTempFile(data.imageData);
                }
                const filename = `groupCover-${data.groupName}${path_1.default.extname(tempPath)}`;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const uploadData = yield image_1.default.uploadImage(filename, 'files', {
                    path: tempPath,
                    uid,
                    name: 'groupCover',
                });
                yield Groups.setGroupField(data.groupName, 'cover:url', uploadData.url);
                yield image_1.default.resizeImage({
                    path: tempPath,
                    width: 358,
                });
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const thumbUploadData = yield image_1.default.uploadImage(`groupCoverThumb-${data.groupName}${path_1.default.extname(tempPath)}`, 'files', {
                    path: tempPath,
                    uid,
                    name: 'groupCover',
                });
                yield Groups.setGroupField(data.groupName, 'cover:thumb:url', thumbUploadData.url);
                if (data.position) {
                    yield Groups.updateCoverPosition(data.groupName, data.position);
                }
                return { url: uploadData.url };
            }
            catch (_c) {
            }
            finally {
                if (tempPath) {
                    yield file_1.default.delete(tempPath);
                }
            }
        });
    };
    Groups.removeCover = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            const fields = ['cover:url', 'cover:thumb:url'];
            const values = yield Groups.getGroupFields(data.groupName, fields);
            yield Promise.all(fields.map((field) => __awaiter(this, void 0, void 0, function* () {
                if (values[field] &&
                    values[field].startsWith(
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    `${nconf_1.default.get('relative_path')}/assets/uploads/files/`)) {
                    const filename = values[field].split('/').pop() || '';
                    const filePath = path_1.default.join(
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    nconf_1.default.get('upload_path'), 'files', filename);
                    yield file_1.default.delete(filePath);
                }
            })));
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.deleteObjectFields(`group:${data.groupName}`, [
                'cover:url',
                'cover:thumb:url',
                'cover:position',
            ]);
        });
    };
}
exports.default = default_1;
