import webserver from '../webserver';
import plugins from '../plugins';
import groups from '../groups';
import index from './index';
import func from '../promisify';

type LayoutData = {
    templates: TemplateData[],
    areas: AreaData[],
    availableWidgets: Widget[]
}

type TemplateData = {
    template: string,
    areas: AreaData[]
}

type AreaData = {
    name: string,
    template?: string,
    location: string,
    data?: unknown
}

interface Widget {
    content: string;
}

interface Group {
    system: number;
}

export async function getAreas(): Promise<AreaData[]> {
    const defaultAreas: AreaData[] = [
        { name: 'Global Sidebar', template: 'global', location: 'sidebar' },
        { name: 'Global Header', template: 'global', location: 'header' },
        { name: 'Global Footer', template: 'global', location: 'footer' },

        { name: 'Group Page (Left)', template: 'groups/details.tpl', location: 'left' },
        { name: 'Group Page (Right)', template: 'groups/details.tpl', location: 'right' },
    ];

    const areas: AreaData[] = (await plugins.hooks.fire('filter:widgets.getAreas', defaultAreas) as AreaData[]);

    areas.push({ name: 'Draft Zone', template: 'global', location: 'drafts' });
    const areaData: unknown[] = await Promise.all(areas.map(area => index.getArea(area.template, area.location)));
    areas.forEach((area, i) => {
        area.data = areaData[i];
    });
    return areas;
}

async function renderAdminTemplate(): Promise<unknown> {
    const groupsData: Group[] = (await groups.getNonPrivilegeGroups('groups:createtime', 0, -1) as Group[]);
    groupsData.sort((a, b) => b.system - a.system);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return (await webserver.app.renderAsync('admin/partials/widget-settings', { groups: groupsData }) as unknown);
}

function buildTemplatesFromAreas(areas: AreaData[]): TemplateData[] {
    const templates: TemplateData[] = [];
    const list: { [key: string]: number } = {};
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

async function getAvailableWidgets(): Promise<Widget[]> {
    const [availableWidgets, adminTemplate]: [Widget[], unknown] = await Promise.all([
        (plugins.hooks.fire('filter:widgets.getWidgets', []) as Widget[]),
        renderAdminTemplate(),
    ]);

    availableWidgets.forEach((w: Widget) => {
        w.content += adminTemplate;
    });

    return availableWidgets;
}

export async function get(): Promise<LayoutData> {
    const [areas, availableWidgets]: [AreaData[], Widget[]] = await Promise.all([
        getAreas(),
        getAvailableWidgets(),
    ]);

    return {
        templates: buildTemplatesFromAreas(areas),
        areas: areas,
        availableWidgets: availableWidgets,
    };
}

func(exports);
