"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const middleware_1 = __importDefault(require("../../middleware"));
const controllers_1 = __importDefault(require("../../controllers"));
const helpers_1 = __importDefault(require("../helpers"));
const { setupApiRoute } = helpers_1.default;
const router = express_1.default.Router();
// eslint-disable-next-line no-unused-vars
// function guestRoutes() {
//     // like registration, login...
// }
function authenticatedRoutes() {
    const middlewares = [middleware_1.default.ensureLoggedIn];
    setupApiRoute(router, 'post', '/', [...middlewares, middleware_1.default.checkRequired.bind(null, ['username'])], controllers_1.default.write.users.create);
    setupApiRoute(router, 'delete', '/', [...middlewares, middleware_1.default.checkRequired.bind(null, ['uids'])], controllers_1.default.write.users.deleteMany);
    setupApiRoute(router, 'head', '/:uid', [middleware_1.default.assert.user], controllers_1.default.write.users.exists);
    setupApiRoute(router, 'get', '/:uid', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.get);
    setupApiRoute(router, 'put', '/:uid', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.update);
    setupApiRoute(router, 'delete', '/:uid', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.delete);
    setupApiRoute(router, 'put', '/:uid/picture', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.changePicture);
    setupApiRoute(router, 'delete', '/:uid/content', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.deleteContent);
    setupApiRoute(router, 'delete', '/:uid/account', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.deleteAccount);
    setupApiRoute(router, 'put', '/:uid/settings', [...middlewares, middleware_1.default.checkRequired.bind(null, ['settings'])], controllers_1.default.write.users.updateSettings);
    setupApiRoute(router, 'put', '/:uid/password', [...middlewares, middleware_1.default.checkRequired.bind(null, ['newPassword']), middleware_1.default.assert.user], controllers_1.default.write.users.changePassword);
    setupApiRoute(router, 'put', '/:uid/follow', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.follow);
    setupApiRoute(router, 'delete', '/:uid/follow', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.unfollow);
    setupApiRoute(router, 'put', '/:uid/ban', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.ban);
    setupApiRoute(router, 'delete', '/:uid/ban', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.unban);
    setupApiRoute(router, 'put', '/:uid/mute', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.mute);
    setupApiRoute(router, 'delete', '/:uid/mute', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.unmute);
    setupApiRoute(router, 'post', '/:uid/tokens', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.generateToken);
    setupApiRoute(router, 'delete', '/:uid/tokens/:token', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.deleteToken);
    setupApiRoute(router, 'delete', '/:uid/sessions/:uuid', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.revokeSession);
    setupApiRoute(router, 'post', '/:uid/invites', middlewares, controllers_1.default.write.users.invite);
    setupApiRoute(router, 'get', '/:uid/invites/groups', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.getInviteGroups);
    setupApiRoute(router, 'get', '/:uid/emails', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.listEmails);
    setupApiRoute(router, 'get', '/:uid/emails/:email', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.getEmail);
    setupApiRoute(router, 'post', '/:uid/emails/:email/confirm', [...middlewares, middleware_1.default.assert.user], controllers_1.default.write.users.confirmEmail);
    setupApiRoute(router, 'head', '/:uid/exports/:type', [...middlewares, middleware_1.default.assert.user, middleware_1.default.checkAccountPermissions], controllers_1.default.write.users.checkExportByType);
    setupApiRoute(router, 'get', '/:uid/exports/:type', [...middlewares, middleware_1.default.assert.user, middleware_1.default.checkAccountPermissions], controllers_1.default.write.users.getExportByType);
    setupApiRoute(router, 'post', '/:uid/exports/:type', [...middlewares, middleware_1.default.assert.user, middleware_1.default.checkAccountPermissions], controllers_1.default.write.users.generateExportsByType);
    // Shorthand route to access user routes by userslug
    router.all('/+bySlug/:userslug*?', [], controllers_1.default.write.users.redirectBySlug);
}
function default_1() {
    authenticatedRoutes();
    return router;
}
exports.default = default_1;
