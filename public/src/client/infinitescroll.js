'use strict';


define('forum/infinitescroll', ['hooks', 'alerts', 'api'], function (hooks, alerts, api) {
	const scroll = {};
	let callback;
	let previousScrollTop = 0;
	let loadingMore = false;
	let container;
	let scrollTimeout = 0;

	scroll.init = function (el, cb) {
		const $body = $('body');
		if (typeof el === 'function') {
			callback = el;
			container = $body;
		} else {
			callback = cb;
			container = el || $body;
		}
		previousScrollTop = $(window).scrollTop();
		$(window).off('scroll', startScrollTimeout).on('scroll', startScrollTimeout);
		if ($body.height() <= $(window).height() && (
			!ajaxify.data.hasOwnProperty('pageCount') || ajaxify.data.pageCount > 1
		)) {
			callback(1);
		}
	};

	function startScrollTimeout() {
		if (scrollTimeout) {
			clearTimeout(scrollTimeout);
		}
		scrollTimeout = setTimeout(function () {
			scrollTimeout = 0;
			onScroll();
		}, 60);
	}

	function onScroll() {

		if (skipScroll()) {
			return;
		}

		const metrics = getMetrics();
		const direction = getDirection(metrics.currentScrollTop);

		if (getTrigger(metrics)) {
			callback(direction);
		}

		previousScrollTop = metrics.currentScrollTop;

	}

	function skipScroll() {

		const bsEnv = utils.findBootstrapEnvironment();
		const mobileComposerOpen = (bsEnv === 'xs' || bsEnv === 'sm') && $('html').hasClass('composing');
		
		return loadingMore || mobileComposerOpen || app.flags._glance;

	}

	function getMetrics() {
		
		const currentScrollTop = $(window).scrollTop();
		const wh = $(window).height();
		
		const offset = container.offset();
		const offsetTop = offset ? offset.top : 0;
		
		const viewportHeight = container.height() - wh;
		
		const denominator = viewportHeight <= 0 ? wh : viewportHeight;
		
		const scrollPercent = 100 * (currentScrollTop - offsetTop) / denominator;

		return { currentScrollTop, viewportHeight, scrollPercent };

	}

	function getDirection(currentScrollTop) {

		return currentScrollTop > previousScrollTop ? 1 : -1;
	
	}

	function getTrigger(metrics) {

		const top = 15;
		const bottom = 85;

		const scrollUp = metrics.currentScrollTop < previousScrollTop;
		const scrollDown = metrics.currentScrollTop > previousScrollTop;

		if (metrics.scrollPercent < top && scrollUp) {
			return true;
		} 

		if (metrics.scrollPercent > bottom && scrollDown) {
			return true;
		} 

		if (metrics.scrollPercent < 0 && scrollDown && metrics.viewportHeight < 0) {
			return true;
		}

		return false;

	}

	scroll.loadMore = function (method, data, callback) {
		if (loadingMore) {
			return;
		}
		loadingMore = true;

		const hookData = { method: method, data: data };
		hooks.fire('action:infinitescroll.loadmore', hookData);

		const call = hookData.method.startsWith('/') ? api.get : socket.emit;

		call(hookData.method, hookData.data, function (err, data) {
			if (err) {
				loadingMore = false;
				return alerts.error(err);
			}
			callback(data, function () {
				loadingMore = false;
			});
		});
	};

	scroll.loadMoreXhr = function (data, callback) {
		if (loadingMore) {
			return;
		}
		loadingMore = true;
		const url = config.relative_path + '/api' + location.pathname.replace(new RegExp('^' + config.relative_path), '');
		const hookData = { url: url, data: data };
		hooks.fire('action:infinitescroll.loadmore.xhr', hookData);

		$.get(url, data, function (data) {
			callback(data, function () {
				loadingMore = false;
			});
		}).fail(function (jqXHR) {
			loadingMore = false;
			alerts.error(String(jqXHR.responseJSON || '[[error:no-connection]]'));
		});
	};

	scroll.removeExtra = function (els, direction, count) {
		let removedEls = $();
		if (els.length <= count) {
			return removedEls;
		}

		const removeCount = els.length - count;
		if (direction > 0) {
			const height = $(document).height();
			const scrollTop = $(window).scrollTop();
			removedEls = els.slice(0, removeCount).remove();
			$(window).scrollTop(scrollTop + ($(document).height() - height));
		} else {
			removedEls = els.slice(els.length - removeCount).remove();
		}
		return removedEls;
	};

	return scroll;
});
