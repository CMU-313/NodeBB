'use strict';

define('accounts/delete', ['api', 'bootbox', 'alerts'], function (api, bootbox, alerts) {
	const Delete = {};

	Delete.account = function (uid, callback) {
		executeAction({
			uid,
			confirmText : '[[user:delete-this-account-confirm]]',
			path : '/account',
			successText : '[[user:account-deleted]]',
			callback,
		});
	};

	Delete.content = function (uid, callback) {
		executeAction({
			uid,
			confirmText : '[[user:delete-account-content-confirm]]',
			path : '/content',
			successText : '[[user:account-content-deleted]]',
			callback,
		});
	};

	Delete.purge = function (uid, callback) {
		executeAction({
			uid,
			confirmText : '[[user:delete-all-confirm]]',
			path : '',
			successText : '[[user:account-deleted]]',
			callback,
		});
	};

	function executeAction({uid, confirmText, path, successText, callback}) {
		bootbox.confirm(confirmText, function (confirm) {
			if (!confirm) {
				return;
			}

			api.del(`/users/${encodeURIComponent(uid)}${path}`, {}).then(() => {
				alerts.success(successText);

				if (typeof callback === 'function') {
					return callback();
				}
			}).catch(alerts.error);
		});
	}

	return Delete;
});
