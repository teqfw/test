/**
 * This es6-module creates test environment for TeqFW plugins and projects.
 * @namespace TeqFw_Test_Back
 */
import Config from './Dto/Config.mjs';
import Container from "@teqfw/di";
import {dirname, join} from 'path';

/**
 * Compose configuration object for test environment.
 * @type {TeqFw_Test_Back_Dto_Config}
 */
const config = (() => {
    const res = new Config();
    const url = new URL(import.meta.url);
    const pathScript = dirname(url.pathname);
    res.pathToRoot = join(pathScript, '../../../../../');
    return res;
})();

/**
 * Create and setup DI container (once per all imports).
 * @type {TeqFw_Di_Shared_Container}
 */
const container = await (async function (cfg) {
    /** @type {TeqFw_Di_Shared_Container} */
    const res = new Container();
    const pathNode = join(cfg.pathToRoot, 'node_modules');
    const srcTeqFwDi = join(pathNode, '@teqfw/di/src');
    const srcTeqFwCore = join(pathNode, '@teqfw/core/src');

    // add backend sources to map
    res.addSourceMapping('TeqFw_Core', srcTeqFwCore, true, 'mjs');
    res.addSourceMapping('TeqFw_Di', srcTeqFwDi, true, 'mjs');

    /** @type {TeqFw_Core_Back_App_Init_Plugin} */
    const scan = await res.get('TeqFw_Core_Back_App_Init_Plugin$');
    const registry = await scan.exec(cfg.pathToRoot);
    /** @type {TeqFw_Core_Back_Defaults} */
    const DEF = await res.get('TeqFw_Core_Back_Defaults$');
    for (const item of registry.items()) {
        /** @type {TeqFw_Di_Back_Api_Dto_Plugin_Desc} */
        const desc = item.teqfw[DEF.MOD_DI.NAME];
        /** @type {TeqFw_Di_Shared_Api_Dto_Plugin_Desc_Autoload} */
        const auto = desc.autoload;
        const ns = auto.ns;
        const path = join(item.path, auto.path);
        res.addSourceMapping(ns, path, true);
    }
    for (const item of registry.getItemsByLevels()) {
        /** @type {TeqFw_Di_Back_Api_Dto_Plugin_Desc} */
        const desc = item.teqfw[DEF.MOD_DI.NAME];
        if (Array.isArray(Object.keys(desc?.replace)))
            for (const orig of Object.keys(desc.replace)) {
                const one = desc.replace[orig];
                if (typeof one === 'string') {
                    res.addModuleReplacement(orig, one);
                } else if (typeof one === 'object') {
                    if (typeof one[DEF.AREA] === 'string') {
                        res.addModuleReplacement(orig, one[DEF.AREA]);
                    }
                }
            }
    }
    return res;
})(config);

/**
 * RDBMS types codifier.
 * @memberOf TeqFw_Test_Back
 */
const RDBMS = {
    MARIADB: 'mariadb',
    POSTGRESQL: 'pg',
    SQLITE: 'sqlite',
};

/**
 * Load local config (./test/data/cfg/local.json).
 * @typedef {Object}
 */
const localCfg = await (async function (cfg, container) {
    // DEFINE INNER FUNCTIONS
    /**
     * Default connection parameters to PostgreSQL/MariaDB/MySQL/SQLite database.
     * Override these params in local configuration (./test/data/cfg/local.json).
     *
     * @return {Object}
     */
    function generateDefault() {
        const connDef = {
            database: 'teqfw_db_test',
            host: '127.0.0.1',
            password: 'PasswordToConnectToTeqFWDb',
            user: 'teqfw'
        };
        const connSqlite = {
            filename: join(cfg.pathToRoot, './test/data/testDb.sqlite'),
        };
        return {
            mariadb: {client: 'mysql2', connection: connDef},
            pg: {client: 'pg', connection: connDef},
            sqlite: {
                client: 'sqlite3',
                connection: connSqlite,
                useNullAsDefault: true,
            }
        };
    }

    // MAIN FUNCTIONALITY
    const filename = join(cfg.pathToRoot, './test/data/cfg/local.json');
    /** @type {TeqFw_Core_Back_Util.readJson|function} */
    const readJson = await container.get('TeqFw_Core_Back_Util#readJson');
    const local = readJson(filename);
    return local ?? generateDefault();
})(config, container);

/**
 * Use this function in tests to init DB connections.
 *
 * @return {Promise<TeqFw_Db_Back_RDb_Connect>}
 * @memberOf TeqFw_Test_Back
 */
const dbConnect = async function (db = null) {
    /** @type {TeqFw_Db_Back_RDb_Connect} */
    const conn = await container.get('TeqFw_Db_Back_RDb_Connect$$'); // instance
    switch (db) {
        case RDBMS.MARIADB:
            await conn.init(localCfg.mariadb);
            break;
        case RDBMS.POSTGRESQL:
            await conn.init(localCfg.pg);
            break;
        default:
            await conn.init(localCfg.sqlite);
    }
    return conn;
}

export {
    config,
    container,
    dbConnect,
    RDBMS,
}
