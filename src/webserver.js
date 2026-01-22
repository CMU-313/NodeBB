/**
 * Server startup and listening logic.
 *
 * Responsible for resolving port or socket configuration, validating runtime
 * options, configuring proxy behavior, and starting the HTTP server.
 *
 * Supports:
 *  - Numeric ports
 *  - Port arrays (defaults to first entry)
 *  - Unix domain sockets
 *
 * Includes safety checks, logging, and environment-specific warnings to ensure
 * predictable startup behavior.
 * 
 * @note Documentation was generated with an LLM, and while I reviewed it, 
 * trust but verify.
 */

'use strict';

const fs = require('fs');
const util = require('util');
const path = require('path');
const nconf = require('nconf');
const express = require('express');
const chalk = require('chalk');

const app = express();

/**
 * Promise-based wrapper around Express's callback-style `app.render`.
 *
 * Usage:
 *   const html = await app.renderAsync('template', data);
 *
 * This is primarily used by parts of the codebase that want to render templates
 * inside async workflows without manually wrapping callbacks.
 */
app.renderAsync = util.promisify((tpl, data, callback) => app.render(tpl, data, callback));

let server;
const winston = require('winston');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const useragent = require('express-useragent');
const favicon = require('serve-favicon');
const detector = require('@nodebb/spider-detector');
const helmet = require('helmet');

const Benchpress = require('benchpressjs');
const db = require('./database');
const analytics = require('./analytics');
const errors = require('./meta/errors');
const file = require('./file');
const emailer = require('./emailer');
const meta = require('./meta');
const logger = require('./logger');
const plugins = require('./plugins');
const flags = require('./flags');
const topicEvents = require('./topics/events');
const privileges = require('./privileges');
const routes = require('./routes');
const auth = require('./routes/authentication');

const helpers = require('./helpers');

// Create server instance based on SSL configuration.
if (nconf.get('ssl')) {
	server = require('https').createServer(
		{
			key: fs.readFileSync(nconf.get('ssl').key),
			cert: fs.readFileSync(nconf.get('ssl').cert),
		},
		app
	);
} else {
	server = require('http').createServer(app);
}

module.exports.server = server;
module.exports.app = app;

server.on('error', (err) => {
	if (err.code === 'EADDRINUSE') {
		winston.error(`NodeBB address in use, exiting...\n${err.stack}`);
	} else {
		winston.error(err.stack);
	}

	throw err;
});

// see https://github.com/isaacs/server-destroy/blob/master/index.js
const connections = {};
server.on('connection', (conn) => {
	const key = `${conn.remoteAddress}:${conn.remotePort}`;
	connections[key] = conn;
	conn.on('close', () => {
		delete connections[key];
	});
});

/**
 * Gracefully shuts down the HTTP(S) server and force-destroys any active sockets.
 *
 * Why both?
 * - `server.close()` stops accepting new connections and waits for existing
 *   keep-alive connections to finish, but that can hang indefinitely in
 *   real-world conditions.
 * - Destroying tracked sockets guarantees process shutdown (useful for tests,
 *   restarts, or hard shutdown paths).
 *
 * Side effects:
 * - Stops accepting new connections immediately.
 * - Destroys all currently tracked connections, even if mid-request.
 *
 * @returns {Promise<void>} Resolves once `server.close()` completes. Rejects if
 *   `server.close()` reports an error.
 */
exports.destroy = function () {
	return new Promise((resolve, reject) => {
		server.close((err) => {
			if (err) reject(err);
			else resolve();
		});
		for (const connection of Object.values(connections)) {
			connection.destroy();
		}
	});
};

/**
 * Returns the number of currently open TCP connections tracked by the server.
 *
 * This is based on the `server.on('connection')` bookkeeping above.
 *
 * @returns {number} Count of active (not-yet-closed) connections.
 */
exports.getConnectionCount = function () {
	return Object.keys(connections).length;
};

/**
 * Full NodeBB bootstrap entrypoint.
 *
 * Order matters:
 * 1) Register emailer app hooks/routes early (often depends on `app`).
 * 2) Configure Express (templating, middleware, sessions, security headers).
 * 3) Register global helpers used by templates/controllers.
 * 4) Initialize logging (may attach to Express for request logging).
 * 5) Initialize core NodeBB subsystems (plugins, routes, privileges, etc.).
 * 6) Emit "ready" events for socket.io and plugin hooks.
 * 7) Begin listening on the configured port or UNIX domain socket.
 *
 * Error behavior:
 * - Any thrown/rejected error aborts startup and propagates to caller.
 *
 * @returns {Promise<void>} Resolves once the server is successfully listening.
 */
exports.listen = async function () {
	emailer.registerApp(app);
	setupExpressApp(app);
	helpers.register();
	logger.init(app);

	await initializeNodeBB();
	winston.info('🎉 NodeBB Ready');

	// Notify runtime components that NodeBB finished initialization.
	require('./socket.io').server.emit('event:nodebb.ready', {});
	plugins.hooks.fire('action:nodebb.ready');

	await listen();
};

/**
 * Initializes core NodeBB subsystems required before accepting requests.
 *
 * Key responsibilities:
 * - Initialize theme path resolution (templates/assets).
 * - Initialize plugins and allow them to hook into startup.
 * - Fire plugin hooks for static asset preparation and preload.
 * - Register routes (core + plugin routes).
 * - Initialize privilege system, blacklist, flags, analytics, errors, and topic events.
 * - Optionally run startup jobs when `runJobs` is enabled.
 *
 * Ordering constraints:
 * - `meta.themes.setupPaths()` should precede plugin init so plugins can locate theme assets.
 * - Hooks `static:assets.prepare` and `static:app.preload` must occur before `routes(...)`
 *   if plugins expect to mutate assets/state before routes are registered.
 *
 * @returns {Promise<void>} Resolves when all startup steps complete.
 */
async function initializeNodeBB() {
	const middleware = require('./middleware');

	await meta.themes.setupPaths();
	await plugins.init(app, middleware);

	await plugins.hooks.fire('static:assets.prepare', {});
	await plugins.hooks.fire('static:app.preload', {
		app: app,
		middleware: middleware,
	});

	await routes(app, middleware);

	await privileges.init();
	await meta.blacklist.load();
	await flags.init();
	await analytics.init();
	await errors.init();
	await topicEvents.init();

	// Optional housekeeping jobs at startup.
	if (nconf.get('runJobs')) {
		await require('./widgets').moveMissingAreasToDrafts();
	}
}

/**
 * Configures the Express app with:
 * - Benchpress templating (tpl -> compiled js)
 * - View engine settings and caching/minification toggles
 * - Compression (optional)
 * - Relative path redirect guard (optional)
 * - Health endpoints (/ping and /sping)
 * - Favicon + touch icon routes
 * - Body parsers (urlencoded + JSON variants)
 * - Cookies, session store, useragent parsing, spider detection
 * - Helmet security headers
 * - Core middleware for headers/rendering and authentication
 * - AsyncLocalStorage request context propagation (uid + request metadata)
 * - Event loop lag monitoring via toobusy-js
 *
 * Side effects:
 * - Mutates `app` by registering middleware and routes.
 * - Reads configuration from `nconf` and `meta.config`.
 *
 * @param {import('express').Express} app - The Express application instance to configure.
 * @returns {void}
 */
function setupExpressApp(app) {
	const middleware = require('./middleware');
	const pingController = require('./controllers/ping');

	const relativePath = nconf.get('relative_path');
	const viewsDir = nconf.get('views_dir');

	// Register Benchpress engine: `.tpl` maps to compiled `.js`.
	app.engine('tpl', (filepath, data, next) => {
		filepath = filepath.replace(/\.tpl$/, '.js');
		Benchpress.__express(filepath, data, next);
	});

	app.set('view engine', 'tpl');
	app.set('views', viewsDir);

	// Pretty JSON in development for easier debugging.
	app.set('json spaces', global.env === 'development' ? 4 : 0);

	// Flash messages (stored in session).
	app.use(flash());

	// Cache compiled views (and optionally more caching/minification in prod).
	app.enable('view cache');

	if (global.env !== 'development') {
		app.enable('cache');
		app.enable('minification');
	}

	// Enable compression when configured.
	if (meta.config.useCompression) {
		const compression = require('compression');
		app.use(compression());
	}

	// If hosted under a base path, redirect requests that miss the base path.
	if (relativePath) {
		app.use((req, res, next) => {
			if (!req.path.startsWith(relativePath)) {
				return require('./controllers/helpers').redirect(res, req.path);
			}
			next();
		});
	}

	// Health endpoints for monitoring.
	app.get(`${relativePath}/ping`, pingController.ping);
	app.get(`${relativePath}/sping`, pingController.ping);

	setupFavicon(app);

	// Touch icon for iOS devices.
	app.use(`${relativePath}/apple-touch-icon`, middleware.routeTouchIcon);

	configureBodyParser(app);

	// Cookie + session + request classification middleware.
	app.use(cookieParser(nconf.get('secret')));
	app.use(useragent.express());
	app.use(detector.middleware());

	app.use(
		session({
			store: db.sessionStore,
			secret: nconf.get('secret'),
			key: nconf.get('sessionKey'),
			cookie: setupCookie(),
			resave: nconf.get('sessionResave') || false,
			saveUninitialized: nconf.get('sessionSaveUninitialized') || false,
		})
	);

	setupHelmet(app);

	// NodeBB middleware pipeline.
	app.use(middleware.addHeaders);
	app.use(middleware.processRender);

	// Authentication middleware/routes.
	auth.initialize(app, middleware);

	// Propagate request-scoped context via ALS.
	const als = require('./als');
	const apiHelpers = require('./api/helpers');
	app.use((req, res, next) => {
		als.run(
			{
				uid: req.uid,
				req: apiHelpers.buildReqObject(req),
			},
			next
		);
	});

	// Event loop lag monitoring (configured by meta.config).
	const toobusy = require('toobusy-js');
	toobusy.maxLag(meta.config.eventLoopLagThreshold);
	toobusy.interval(meta.config.eventLoopInterval);
}

/**
 * Installs Helmet with NodeBB-specific configuration.
 *
 * Notes:
 * - CSP is disabled because Helmet's defaults are too restrictive for many
 *   NodeBB plugins (which may load external scripts/styles).
 * - COOP/CORP/COEP policies are configured from meta.config (if present).
 * - HSTS is optionally enabled depending on meta config flags.
 *
 * Error behavior:
 * - If Helmet initialization throws (misconfiguration / invalid header settings),
 *   the error is logged and startup continues without Helmet.
 *
 * @param {import('express').Express} app - Express application instance.
 * @returns {void}
 */
function setupHelmet(app) {
	const options = {
		contentSecurityPolicy: false, // defaults are too restrive and break plugins that load external assets...
		crossOriginOpenerPolicy: { policy: meta.config['cross-origin-opener-policy'] },
		crossOriginResourcePolicy: { policy: meta.config['cross-origin-resource-policy'] },
		referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
		crossOriginEmbedderPolicy: !!meta.config['cross-origin-embedder-policy'],
	};

	if (meta.config['hsts-enabled']) {
		options.hsts = {
			maxAge: Math.max(0, meta.config['hsts-maxage']),
			includeSubDomains: !!meta.config['hsts-subdomains'],
			preload: !!meta.config['hsts-preload'],
		};
	}

	try {
		app.use(helmet(options));
	} catch (err) {
		winston.error(`[startup] unable to initialize helmet \n${err.stack}`);
	}
}

/**
 * Registers `serve-favicon` middleware if a favicon file exists.
 *
 * Behavior:
 * - Uses configured favicon path from `meta.config['brand:favicon']`, falling back
 *   to `favicon.ico`.
 * - Rewrites old-style `assets/uploads/...` into `uploads/...` within `public/`.
 * - Only installs the middleware when the favicon file exists on disk.
 *
 * @param {import('express').Express} app - Express application instance.
 * @returns {void}
 */
function setupFavicon(app) {
	let faviconPath = meta.config['brand:favicon'] || 'favicon.ico';
	faviconPath = path.join(nconf.get('base_dir'), 'public', faviconPath.replace(/assets\/uploads/, 'uploads'));
	if (!faviconPath.startsWith(nconf.get('upload_path'))) {
		faviconPath = path.join(nconf.get('base_dir'), 'public', 'favicon.ico');
	}
	if (file.existsSync(faviconPath)) {
		app.use(nconf.get('relative_path'), favicon(faviconPath));
	}
}

/**
 * Configures request body parsing for:
 * - URL-encoded forms (`application/x-www-form-urlencoded`)
 * - JSON payloads, including JSON-LD and ActivityPub variants by default
 *
 * Configuration:
 * - URL-encoded options can be overridden via `nconf.get('bodyParser:urlencoded')`.
 *   If no `extended` is specified, it defaults to `true`.
 * - JSON options can be overridden via `nconf.get('bodyParser:json')`.
 *
 * Side effects:
 * - Registers body-parser middleware on the app.
 *
 * @param {import('express').Express} app - Express application instance.
 * @returns {void}
 */
function configureBodyParser(app) {
	const urlencodedOpts = nconf.get('bodyParser:urlencoded') || {};
	if (!urlencodedOpts.hasOwnProperty('extended')) {
		urlencodedOpts.extended = true;
	}
	app.use(bodyParser.urlencoded(urlencodedOpts));

	const jsonOpts = {
		type: [
			'application/json',
			'application/ld+json',
			'application/activity+json',
		],
		...nconf.get('bodyParser:json'),
	};
	app.use(bodyParser.json(jsonOpts));
}

/**
 * Computes the session cookie configuration used by express-session.
 *
 * Behavior:
 * - Starts with the cookie config object from `meta.configs.cookie.get()`.
 * - Computes TTL based on `meta.getSessionTTLSeconds()` and converts to ms.
 * - Assigns computed TTL to `cookie.maxAge` and returns the updated config.
 *
 * Side effects:
 * - Mutates the object returned by `meta.configs.cookie.get()` by setting maxAge.
 *
 * @returns {object} Cookie options object suitable for express-session.
 */
function setupCookie() {
	const cookie = meta.configs.cookie.get();
	const ttl = meta.getSessionTTLSeconds() * 1000;
	cookie.maxAge = ttl;

	return cookie;
}

/**
 * Normalizes NodeBB's `port` configuration into either:
 * - A UNIX domain socket binding target, OR
 * - A TCP port number binding target.
 *
 * Supported raw port formats:
 * - number: `4567`
 * - numeric string: `"4567"`
 * - UNIX socket path string: `"/tmp/nodebb.sock"`
 * - array: `[4567, 4568]` (NOT supported for multi-bind here; warns and uses first)
 *
 * Error behavior:
 * - If an empty array is provided, logs and exits the process.
 * - If array[0] is falsy after normalization, logs and exits the process.
 *
 * @param {number|string|Array|any} rawPort - Value from `nconf.get('port')`.
 * @returns {{isSocket: boolean, port: (number|null), socketPath: string}}
 *   - `isSocket`: true when binding to a UNIX socket path.
 *   - `port`: parsed TCP port when `isSocket` is false; otherwise null.
 *   - `socketPath`: socket path when `isSocket` is true; otherwise empty string.
 */
function resolvePortOrSocket(rawPort) {
	// rawPort can be: number|string, array, or socket path string
	const isSocket = isNaN(rawPort) && !Array.isArray(rawPort);
	if (isSocket) {
		return { isSocket: true, port: null, socketPath: String(rawPort) };
	}

	if (Array.isArray(rawPort)) {
		if (!rawPort.length) {
			winston.error('[startup] empty ports array in config.json');
			process.exit();
		}

		winston.warn('[startup] If you want to start nodebb on multiple ports please use loader.js');
		winston.warn(`[startup] Defaulting to first port in array, ${rawPort[0]}`);

		rawPort = rawPort[0];
		if (!rawPort) {
			winston.error('[startup] Invalid port, exiting');
			process.exit();
		}
	}

	const port = parseInt(rawPort, 10);
	return { isSocket: false, port, socketPath: '' };
}

/**
 * Conditionally enables Express `trust proxy`.
 *
 * Rationale:
 * - When NodeBB is behind a reverse proxy (common in production), Express needs
 *   `trust proxy` enabled to correctly interpret `X-Forwarded-*` headers.
 * - This affects things like `req.ip`, `req.protocol`, secure cookies, etc.
 *
 * Activation rules:
 * - If binding to non-standard ports (not 80/443), enable trust proxy (historical default).
 * - OR if `nconf.get('trust_proxy') === true`, always enable.
 *
 * Side effects:
 * - Mutates Express app settings by calling `app.enable('trust proxy')`.
 *
 * @param {import('express').Express} app - Express application instance.
 * @param {number} port - TCP port NodeBB will bind to.
 * @returns {void}
 */
function maybeEnableTrustProxy(app, port) {
	const trustProxyCfg = nconf.get('trust_proxy') === true;
	if ((port !== 80 && port !== 443) || trustProxyCfg) {
		winston.info(`🤝 Setting 'trust proxy' to ${JSON.stringify(trustProxyCfg)}`);
		app.set('trust proxy', trustProxyCfg);
	}
}

/**
 * Logs a warning when running on privileged ports (80/443) outside development.
 *
 * Rationale:
 * - Binding to 80/443 may require elevated privileges and is generally discouraged.
 * - Recommended deployment is to run NodeBB on an unprivileged port and put
 *   a reverse proxy (nginx/caddy/haproxy) in front.
 *
 * @param {number} port - TCP port NodeBB will bind to.
 * @returns {void}
 */
function warnAboutPrivilegedPorts(port) {
	if ((port === 80 || port === 443) && process.env.NODE_ENV !== 'development') {
		winston.info('Using ports 80 and 443 is not recommend; use a proxy instead. See README.md');
	}
}

/**
 * Returns the address/interface NodeBB should bind to.
 *
 * Behavior:
 * - Reads `nconf.get('bind_address')`.
 * - If unset or explicitly set to `0.0.0.0`, returns `0.0.0.0` (all interfaces).
 * - Otherwise returns the configured value (e.g., `127.0.0.1`, LAN IP, etc.).
 *
 * @returns {string} Bind address for server.listen.
 */
function getBindAddress() {
	const bind = nconf.get('bind_address');
	return bind === '0.0.0.0' || !bind ? '0.0.0.0' : bind;
}

/**
 * Produces a user-friendly listen target string for logging.
 *
 * @param {object} params
 * @param {boolean} params.isSocket - Whether listening on UNIX socket.
 * @param {string} params.socketPath - UNIX socket path (if isSocket).
 * @param {string} params.bindAddress - TCP bind address (if !isSocket).
 * @param {number|null} params.port - TCP port (if !isSocket).
 * @returns {string} Either socketPath or "bindAddress:port".
 */
function formatListenText({ isSocket, socketPath, bindAddress, port }) {
	return isSocket ? socketPath : `${bindAddress}:${port}`;
}

/**
 * Prepares a UNIX domain socket for binding.
 *
 * Steps:
 * 1) Temporarily sets process umask to 0000 so the created socket can have
 *    permissive filesystem permissions (NodeBB may rely on group/world access
 *    depending on deployment).
 * 2) Calls `exports.testSocket(socketPath)` to ensure that:
 *    - the path is valid,
 *    - a stale socket is removed, and
 *    - the path isn't already in use by a live listener.
 * 3) Returns the previous umask so it can be restored by the caller.
 *
 * Error behavior:
 * - If `testSocket` fails, logs a detailed error, restores umask, and rethrows.
 *
 * @param {string} socketPath - Filesystem path to the UNIX socket.
 * @returns {Promise<number>} Resolves with the previous umask value.
 */
async function prepareSocket(socketPath) {
	const oldUmask = process.umask('0000');
	try {
		await exports.testSocket(socketPath);
		return oldUmask;
	} catch (err) {
		winston.error(
			`[startup] NodeBB was unable to secure domain socket access (${socketPath})\n${err.stack}`
		);
		process.umask(oldUmask);
		throw err;
	}
}

/**
 * Starts the HTTP(S) server listening on either:
 * - a TCP port + bind address, OR
 * - a UNIX domain socket path
 *
 * Responsibilities:
 * - Normalize port/socket config via `resolvePortOrSocket(...)`.
 * - Configure Express trust proxy and privileged port warnings (TCP only).
 * - For UNIX sockets, ensure stale sockets are removed and set umask temporarily.
 * - Promisify `server.listen` to use `await` and structured error handling.
 * - Log listen target and canonical URL on success.
 * - Restore umask after binding a UNIX socket.
 *
 * Error behavior:
 * - If bind/listen fails, logs and rethrows.
 *
 * @returns {Promise<void>} Resolves once the server is actively listening.
 */
async function listen() {
	const { isSocket, port, socketPath } = resolvePortOrSocket(nconf.get('port'));

	// Only meaningful for non-socket
	if (!isSocket) {
		maybeEnableTrustProxy(app, port);
		warnAboutPrivilegedPorts(port);
	}

	const bindAddress = getBindAddress();
	const oldUmask = isSocket ? await prepareSocket(socketPath) : null;

	const listenArgs = isSocket ? [socketPath] : [port, bindAddress];
	const onText = formatListenText({ isSocket, socketPath, bindAddress, port });

	const listenAsync = util.promisify(server.listen.bind(server));

	try {
		await listenAsync(...listenArgs);
		winston.info(`📡 NodeBB is now listening on: ${chalk.yellow(onText)}`);
		winston.info(`🔗 Canonical URL: ${chalk.yellow(nconf.get('url'))}`);
	} catch (err) {
		winston.error(`[startup] NodeBB was unable to listen on: ${chalk.yellow(onText)}`);
		throw err;
	} finally {
		if (oldUmask !== null && oldUmask !== undefined) {
			process.umask(oldUmask);
		}
	}
}

/**
 * Validates a UNIX domain socket path before binding.
 *
 * Behavior:
 * - Rejects non-string input with a descriptive error.
 * - If the path does not exist, resolves immediately (safe to bind).
 * - If the path exists, attempts to connect to it:
 *   - If connection succeeds, something is already listening -> reject with "port-in-use".
 *   - If connection errors with ECONNREFUSED, the socket is stale -> unlink it and resolve.
 *   - If connection errors with something else, reject with the original error.
 *
 * This prevents NodeBB from failing to start due to leftover socket files from
 * prior crashes or unclean shutdowns.
 *
 * @param {string} socketPath - Filesystem path to the UNIX socket.
 * @returns {Promise<void>} Resolves if safe to bind; rejects if in use or on error.
 * @throws {Error} If `socketPath` is not a string.
 */
exports.testSocket = async function (socketPath) {
	if (typeof socketPath !== 'string') {
		throw new Error(`invalid socket path : ${socketPath}`);
	}

	const net = require('net');
	const file = require('./file');

	const exists = await file.exists(socketPath);
	if (!exists) {
		return;
	}

	return new Promise((resolve, reject) => {
		const testSocket = new net.Socket();

		testSocket.on('error', (err) => {
			if (err.code !== 'ECONNREFUSED') {
				return reject(err);
			}

			// The socket was stale, kick it out of the way
			fs.unlink(socketPath, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		testSocket.connect({ path: socketPath }, () => {
			// Something's listening here, abort
			reject(new Error('port-in-use'));
		});
	});
};

// Adds promisified variants of selected exported functions (pattern used across NodeBB).
require('./promisify')(exports);
