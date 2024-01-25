var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var nconf = require('nconf');
var winston = require('winston');
var plugins = require('../../plugins');
var meta = require('../../meta');
var pluginsController = module.exports;
pluginsController.get = function (req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, compatible, all, trending, compatiblePkgNames, installedPlugins, activePlugins, trendingScores, trendingPlugins;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        getCompatiblePlugins(),
                        getAllPlugins(),
                        plugins.listTrending(),
                    ])];
                case 1:
                    _a = _b.sent(), compatible = _a[0], all = _a[1], trending = _a[2];
                    compatiblePkgNames = compatible.map(function (pkgData) { return pkgData.name; });
                    installedPlugins = compatible.filter(function (plugin) { return plugin && plugin.installed; });
                    activePlugins = all.filter(function (plugin) { return plugin && plugin.installed && plugin.active; });
                    trendingScores = trending.reduce(function (memo, cur) {
                        memo[cur.label] = cur.value;
                        return memo;
                    }, {});
                    trendingPlugins = all
                        .filter(function (plugin) { return plugin && Object.keys(trendingScores).includes(plugin.id); })
                        .sort(function (a, b) { return trendingScores[b.id] - trendingScores[a.id]; })
                        .map(function (plugin) {
                        plugin.downloads = trendingScores[plugin.id];
                        return plugin;
                    });
                    res.render('admin/extend/plugins', {
                        installed: installedPlugins,
                        installedCount: installedPlugins.length,
                        activeCount: activePlugins.length,
                        inactiveCount: Math.max(0, installedPlugins.length - activePlugins.length),
                        canChangeState: !nconf.get('plugins:active'),
                        upgradeCount: compatible.reduce(function (count, current) {
                            if (current.installed && current.outdated) {
                                count += 1;
                            }
                            return count;
                        }, 0),
                        download: compatible.filter(function (plugin) { return !plugin.installed; }),
                        incompatible: all.filter(function (plugin) { return !compatiblePkgNames.includes(plugin.name); }),
                        trending: trendingPlugins,
                        submitPluginUsage: meta.config.submitPluginUsage,
                        version: nconf.get('version')
                    });
                    return [2 /*return*/];
            }
        });
    });
};
function getCompatiblePlugins() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getPlugins(true)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function getAllPlugins() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getPlugins(false)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function getPlugins(matching) {
    return __awaiter(this, void 0, void 0, function () {
        var pluginsData, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, plugins.list(matching)];
                case 1:
                    pluginsData = _a.sent();
                    return [2 /*return*/, pluginsData || []];
                case 2:
                    err_1 = _a.sent();
                    winston.error(err_1.stack);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
;
