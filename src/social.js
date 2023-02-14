// This is one of the two example TypeScript files included with the NodeBB repository
// It is meant to serve as an example to assist you with your HW1 translation
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import _ from 'lodash';
import plugins from './plugins';
import db from './database';
let postSharing = null;
export function getPostSharing() {
    return __awaiter(this, void 0, void 0, function* () {
        if (postSharing) {
            return _.cloneDeep(postSharing);
        }
        let networks = [
            {
                id: 'facebook',
                name: 'Facebook',
                class: 'fa-facebook',
                activated: null,
            },
            {
                id: 'twitter',
                name: 'Twitter',
                class: 'fa-twitter',
                activated: null,
            },
        ];
        networks = (yield plugins.hooks.fire('filter:social.posts', networks));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const activated = yield db.getSetMembers('social:posts.activated');
        networks.forEach((network) => {
            network.activated = activated.includes(network.id);
        });
        postSharing = networks;
        return _.cloneDeep(networks);
    });
}
export function getActivePostSharing() {
    return __awaiter(this, void 0, void 0, function* () {
        const networks = yield getPostSharing();
        return networks.filter(network => network && network.activated);
    });
}
export function setActivePostSharingNetworks(networkIDs) {
    return __awaiter(this, void 0, void 0, function* () {
        postSharing = null;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield db.delete('social:posts.activated');
        if (!networkIDs.length) {
            return;
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield db.setAdd('social:posts.activated', networkIDs);
    });
}
