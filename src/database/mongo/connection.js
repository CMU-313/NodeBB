"use strict";
// // import 'nconf' as ncong;
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// // import 'winston' as winston;
// // import 'lodash' as lodash;
// import * as nconf from 'nconf';
// import * as winston from 'winston';
// import * as _ from 'lodash';
// interface connectionType{
//     getConnectionString(mongo : any): string
//     getConnectionOptions(mongo : any): string
//     connect(options: any) : Promise<any>
// }
// const connection : connectionType = module.exports as connectionType;
// // export const connection: any = {};
// connection.getConnectionString = function (mongo) {
//     mongo = mongo || nconf.get('mongo');
//     let usernamePassword = '';
//     const uri: string = mongo.uri || '';
//     if (mongo.username && mongo.password) {
//         usernamePassword = `${mongo.username}:${encodeURIComponent(mongo.password)}@`;
//     } else if (!uri.includes('@') || !uri.slice(uri.indexOf('://') + 3, uri.indexOf('@'))) {
//         winston.warn('You have no mongo username/password setup!');
//     }
//     // Sensible defaults for Mongo, if not set
//     if (!mongo.host) {
//         mongo.host = '127.0.0.1';
//     }
//     if (!mongo.port) {
//         mongo.port = 27017;
//     }
//     const dbName: string = mongo.database;
//     if (dbName === undefined || dbName === '') {
//         winston.warn('You have no database name, using "nodebb"');
//         mongo.database = 'nodebb';
//     }
//     const hosts = mongo.host.split(',');
//     const ports = mongo.port.toString().split(',');
//     const servers = [];
//     for (let i = 0; i < hosts.length; i += 1) {
//         servers.push(`${hosts[i]}:${ports[i]}`);
//     }
//     return uri || `mongodb://${usernamePassword}${servers.join()}/${mongo.database}`;
// };
// connection.getConnectionOptions = function (mongo) {
//     mongo = mongo || nconf.get('mongo');
//     const connOptions = {
//         maxPoolSize: 10,
//         minPoolSize: 3,
//         connectTimeoutMS: 90000,
//     };
//     return _.merge(connOptions, mongo.options || {});
// };
// connection.connect = async function (options) {
//     const mongoClient = require('mongodb').MongoClient;
//     const connString = connection.getConnectionString(options);
//     const connOptions = connection.getConnectionOptions(options);
//     return await mongoClient.connect(connString, connOptions);
// };
const nconf = __importStar(require("nconf"));
const winston = __importStar(require("winston"));
const _ = __importStar(require("lodash"));
const connection = module.exports;
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
connection.getConnectionString = function (mongo) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    mongo = mongo || nconf.get('mongo');
    let usernamePassword = '';
    const uri = mongo.uri || '';
    if (mongo.username && mongo.password) {
        usernamePassword = `${mongo.username}:${encodeURIComponent(mongo.password)}@`;
    }
    else if (!uri.includes('@') || !uri.slice(uri.indexOf('://') + 3, uri.indexOf('@'))) {
        winston.warn('You have no mongo username/password setup!');
    }
    // Sensible defaults for Mongo, if not set
    if (!mongo.host) {
        mongo.host = '127.0.0.1';
    }
    if (!mongo.port) {
        mongo.port = 27017;
    }
    const dbName = mongo.database;
    if (dbName === undefined || dbName === '') {
        winston.warn('You have no database name, using "nodebb"');
        mongo.database = 'nodebb';
    }
    const hosts = mongo.host.split(',');
    const ports = mongo.port.toString().split(',');
    const servers = [];
    for (let i = 0; i < hosts.length; i += 1) {
        servers.push(`${hosts[i]}:${ports[i]}`);
    }
    return uri || `mongodb://${usernamePassword}${servers.join()}/${mongo.database}`;
};
connection.getConnectionOptions = function (mongo) {
    mongo = mongo || nconf.get('mongo');
    const connOptions = {
        maxPoolSize: 10,
        minPoolSize: 3,
        connectTimeoutMS: 90000,
    };
    return _.merge(connOptions, mongo.options || {});
};
connection.connect = function (options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { MongoClient } = require('mongodb'); // Use import statement instead of require
        const connString = connection.getConnectionString(options);
        const connOptions = connection.getConnectionOptions(options);
        return yield MongoClient.connect(connString, connOptions);
    });
};
exports.default = connection; // Export the connection object
