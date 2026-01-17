'use strict';

function createFooterArea() {
	const footerArea = $('#content [widget-area="footer"],#content [data-widget-area="footer"]');
	if (!footerArea.length) {
		$('#content').append($('<div data-widget-area="footer"></div>'));
	}
}

function createSidebarArea() {
	const sidebarArea = $('#content [widget-area="sidebar"],#content [data-widget-area="sidebar"]');
	if (!sidebarArea.length) {
		const accountCover = $('[component="account/cover"]');
		const groupsCover = $('[component="groups/cover"]');
		const sidebarHtml = $('<div class="row"><div class="col-lg-9 col-12"></div><div data-widget-area="sidebar" class="col-lg-3 col-12"></div></div>');
		if (accountCover.length) {
			accountCover.nextAll().wrapAll(sidebarHtml);
		} else if (groupsCover.length) {
			groupsCover.nextAll().wrapAll(sidebarHtml);
		} else {
			$('#content > *').wrapAll(sidebarHtml);
		}
	}
}

function createHeaderArea() {
	const headerArea = $('#content [widget-area="header"],#content [data-widget-area="header"]');
	if (!headerArea.length) {
		$('#content').prepend($('<div class="row"><div data-widget-area="header" class="col-12"></div></div>'));
	}
}

function prcocessWidgetLocation(location) {
	let area = $('#content [widget-area="' + location + '"],#content [data-widget-area="' + location + '"]').eq(0);
	const widgetsAtLocation = ajaxify.data.widgets[location] || [];
	if (area.length || !widgetsAtLocation.length) {
		return;
	}

	const html = widgetsAtLocation.map(widget => widget.html).join('');
	if (!html) {
		return;
	}
	if (location === 'footer') {
		createFooterArea();
	} else if (location === 'sidebar') {
		createSidebarArea();
	} else if (location === 'header') {
		createHeaderArea();
	}
	area = $('#content [widget-area="' + location + '"],#content [data-widget-area="' + location + '"]').eq(0);
	if (html && area.length) {
		area.html(html);
		area.find('img:not(.not-responsive)').addClass('img-fluid');
	}
	if (widgetsAtLocation.length) {
		area.removeClass('hidden');
	}
}

module.exports.render = function (template) {
	if (template.match(/^admin/)) {
		return;
	}
	const widgets = ajaxify.data.widgets || {};
	const locations = Object.keys(widgets);
	locations.forEach(prcocessWidgetLocation);
	require(['hooks'], function (hooks) {
		hooks.fire('action:widgets.loaded', {});
	});
};

