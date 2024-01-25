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
exports.get = exports.getAreas = void 0;
const webserver_1 = __importDefault(require("../webserver"));
const plugins_1 = __importDefault(require("../plugins"));
const groups_1 = __importDefault(require("../groups"));
const index_1 = __importDefault(require("./index"));
function renderAdminTemplate() {
    return __awaiter(this, void 0, void 0, function* () {
        const groupsData = yield groups_1.default.getNonPrivilegeGroups('groups:createtime', 0, -1);
        groupsData.sort((a, b) => b.system - a.system);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return yield webserver_1.default.app.renderAsync('admin/partials/widget-settings', { groups: groupsData });
    });
}
function getAvailableWidgets() {
    return __awaiter(this, void 0, void 0, function* () {
        const [availableWidgets, adminTemplate] = yield Promise.all([
            plugins_1.default.hooks.fire('filter:widgets.getWidgets', []),
            renderAdminTemplate(),
        ]);
        availableWidgets.forEach((w) => {
            w.content += adminTemplate;
        });
        return availableWidgets;
    });
}
function buildTemplatesFromAreas(areas) {
    const templates = [];
    const list = {};
    let index = 0;
    areas.forEach((area) => {
        if (typeof list[area.template] === 'undefined') {
            list[area.template] = index;
            templates.push({
                template: area.template,
                areas: [],
            });
            index += 1;
        }
        templates[list[area.template]].areas.push({
            name: area.name,
            location: area.location,
        });
    });
    return templates;
}
function getAreas() {
    return __awaiter(this, void 0, void 0, function* () {
        const defaultAreas = [
            { name: 'Global Sidebar', template: 'global', location: 'sidebar' },
            { name: 'Global Header', template: 'global', location: 'header' },
            { name: 'Global Footer', template: 'global', location: 'footer' },
            { name: 'Group Page (Left)', template: 'groups/details.tpl', location: 'left' },
            { name: 'Group Page (Right)', template: 'groups/details.tpl', location: 'right' },
        ];
        const areas = yield plugins_1.default.hooks.fire('filter:widgets.getAreas', defaultAreas);
        areas.push({ name: 'Draft Zone', template: 'global', location: 'drafts' });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const areaData = yield Promise.all(areas.map(area => index_1.default.getArea(area.template, area.location)));
        areas.forEach((area, i) => {
            area.data = areaData[i];
        });
        return areas;
    });
}
exports.getAreas = getAreas;
function get() {
    return __awaiter(this, void 0, void 0, function* () {
        const [areas, availableWidgets] = yield Promise.all([
            getAreas(),
            getAvailableWidgets(),
        ]);
        return {
            templates: buildTemplatesFromAreas(areas),
            areas: areas,
            availableWidgets: availableWidgets,
        };
    });
}
exports.get = get;
