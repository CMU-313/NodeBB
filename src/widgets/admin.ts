import webserver from '../webserver';
import plugins from '../plugins';
import groups from '../groups';
import index from './index';

type GroupInfo = {
    system: number;
}

type WidgetData = {
    content: string;
}

type TemplateInfo = {
    template: string;
    areas: Area[];
}

type AreaData = {
    length: number;
}

type Area ={
    name: string;
    location: string;
    template?: string;
    widgets?: WidgetData[];
    data?: AreaData;
}

type AdminInfo = {
    templates: TemplateInfo[];
    areas: Area[];
    availableWidgets: WidgetData[];
}

async function renderAdminTemplate() : Promise<string> {
    const groupsData: GroupInfo[] = await groups.getNonPrivilegeGroups('groups:createtime', 0, -1) as GroupInfo[];
    groupsData.sort((a, b) => b.system - a.system);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return await webserver.app.renderAsync('admin/partials/widget-settings', { groups: groupsData }) as Promise<string>;
}

async function getAvailableWidgets() : Promise<WidgetData[]> {
    const [availableWidgets, adminTemplate] : [WidgetData[], string] = await Promise.all([
        plugins.hooks.fire('filter:widgets.getWidgets', []) as WidgetData[],
        renderAdminTemplate(),
    ]);
    availableWidgets.forEach((w) => {
        w.content += adminTemplate;
    });
    return availableWidgets;
}

type ListForm = {
    [index: string]: number;
}

function buildTemplatesFromAreas(areas: Area[]) : TemplateInfo[] {
    const templates : TemplateInfo[] = [];
    const list : ListForm = {};
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

export async function getAreas(): Promise<Area[]> {
    const defaultAreas : Area[] = [
        { name: 'Global Sidebar', template: 'global', location: 'sidebar' },
        { name: 'Global Header', template: 'global', location: 'header' },
        { name: 'Global Footer', template: 'global', location: 'footer' },

        { name: 'Group Page (Left)', template: 'groups/details.tpl', location: 'left' },
        { name: 'Group Page (Right)', template: 'groups/details.tpl', location: 'right' },
    ];

    const areas : Area[] = await plugins.hooks.fire('filter:widgets.getAreas', defaultAreas) as Area[];

    areas.push({ name: 'Draft Zone', template: 'global', location: 'drafts' });
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const areaData : AreaData = await Promise.all(areas.map(area => index.getArea(area.template, area.location)));
    areas.forEach((area, i) => {
        area.data = areaData[i] as AreaData;
    });
    return areas;
}

export async function get(): Promise<AdminInfo> {
    const [areas, availableWidgets] : [Area[], WidgetData[]] = await Promise.all([
        getAreas(),
        getAvailableWidgets(),
    ]);

    return {
        templates: buildTemplatesFromAreas(areas),
        areas: areas,
        availableWidgets: availableWidgets,
    };
}

