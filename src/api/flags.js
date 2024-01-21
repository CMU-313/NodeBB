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
exports.deleteNote = exports.appendNote = exports.update = exports.create = void 0;
const user_1 = __importDefault(require("../user"));
const flags_1 = __importDefault(require("../flags"));
function create(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const required = ['type', 'id', 'reason'];
        if (!required.every(prop => !!data[prop])) {
            throw new Error('[[error:invalid-data]]');
        }
        const { type, id, reason } = data;
        yield flags_1.default.validate({
            uid: caller.uid,
            type: type,
            id: id,
        });
        const flagObj = yield flags_1.default.create(type, id, caller.uid, reason);
        yield flags_1.default.notify(flagObj, caller.uid);
        return flagObj;
    });
}
exports.create = create;
function update(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const allowed = yield user_1.default.isPrivileged(caller.uid);
        if (!allowed) {
            throw new Error('[[error:no-privileges]]');
        }
        const { flagId } = data;
        delete data.flagId;
        yield flags_1.default.update(flagId, caller.uid, data);
        return yield flags_1.default.getHistory(flagId);
    });
}
exports.update = update;
function appendNote(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const allowed = yield user_1.default.isPrivileged(caller.uid);
        if (!allowed) {
            throw new Error('[[error:no-privileges]]');
        }
        if (data.datetime && data.flagId) {
            try {
                const note = yield flags_1.default.getNote(data.flagId, data.datetime);
                if (note.uid !== caller.uid) {
                    throw new Error('[[error:no-privileges]]');
                }
            }
            catch (e) {
                // Okay if not does not exist in database
                if (e instanceof Error && e.message !== '[[error:invalid-data]]') {
                    throw e;
                }
            }
        }
        yield flags_1.default.appendNote(data.flagId, caller.uid, data.note, data.datetime);
        const [notes, history] = yield Promise.all([
            flags_1.default.getNotes(data.flagId),
            flags_1.default.getHistory(data.flagId),
        ]);
        return { notes: notes, history: history };
    });
}
exports.appendNote = appendNote;
function deleteNote(caller, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const note = yield flags_1.default.getNote(data.flagId, data.datetime);
        if (note.uid !== caller.uid) {
            throw new Error('[[error:no-privileges]]');
        }
        yield flags_1.default.deleteNote(data.flagId, data.datetime);
        yield flags_1.default.appendHistory(data.flagId, caller.uid, {
            notes: '[[flags:note-deleted]]',
            datetime: Date.now(),
        });
        const [notes, history] = yield Promise.all([
            flags_1.default.getNotes(data.flagId),
            flags_1.default.getHistory(data.flagId),
        ]);
        return { notes: notes, history: history };
    });
}
exports.deleteNote = deleteNote;
