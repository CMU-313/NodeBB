'use strict';

const handleError = (err) => {
	if (err) {
		return alert.error(err);
	}
	ajaxify.refresh();
};

define('admin/dashboard/searches', ['alerts', 'bootbox'], (alerts, bootbox) => {
	const ACP = {};

	ACP.init = () => {
		$('#clear-search-history').on('click', () => {
			bootbox.confirm('[[admin/dashboard:clear-search-history-confirm]]', function (ok) {
				if (ok) {
					socket.emit('admin.clearSearchHistory', handleError);
				}
			});
		});
	};

	return ACP;
});
