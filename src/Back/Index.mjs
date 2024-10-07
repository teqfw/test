/**
 * This es6-module creates test environment for TeqFW plugins and projects.
 * @namespace TeqFw_Test_Back
 */
import Config from './Dto/Config.mjs';
import Container from '@teqfw/di';
import {dirname, join} from 'path';
import SPHERE from '@teqfw/core/src/Shared/Enum/Sphere.mjs';
import Replace from '@teqfw/core/src/Shared/App/Di/PreProcessor/Replace.mjs';

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
 * @type {TeqFw_Di_Api_Container}
 */
const container = await (async function (cfg) {
    // FUNCS

    /**
     * Extract autoload data from `@teqfw/di` nodes of descriptors and initialize resolver.
     * @param {TeqFw_Di_Api_Container} container
     * @param {TeqFw_Core_Back_Api_Dto_Plugin_Registry_Item[]} items
     * @param {TeqFw_Core_Back_Defaults} DEF
     */
    function initAutoload(container, items, DEF) {
        const resolver = container.getResolver();
        for (const item of items) {
            /** @type {TeqFw_Core_Back_Plugin_Dto_Desc_Di.Dto} */
            const desc = item.teqfw[DEF.SHARED.NAME_DI];
            /** @type {TeqFw_Core_Back_Plugin_Dto_Desc_Di_Autoload.Dto} */
            const auto = desc.autoload;
            const ext = auto.ext ?? 'js';
            const ns = auto.ns;
            if (ns) {
                const path = join(item.path, auto.path);
                resolver.addNamespaceRoot(ns, path, ext);
            }
        }
    }

    /**
     * Extract data from ordered `@teqfw/di` nodes and initialize replacement for objectKeys.
     * @param {TeqFw_Di_Api_Container} container
     * @param {TeqFw_Core_Back_Api_Dto_Plugin_Registry_Item[]} items - ordered items
     * @param {TeqFw_Core_Back_Defaults} DEF
     */
    function initReplaces(container, items, DEF) {
        const replaceChunk = new Replace();
        for (const item of items) {
            /** @type {TeqFw_Core_Back_Plugin_Dto_Desc_Di.Dto} */
            const desc = item.teqfw[DEF.SHARED.NAME_DI];
            if (Array.isArray(desc?.replaces))
                for (const one of desc.replaces) {
                    if (
                        (one.sphere === SPHERE.BACK) ||
                        (one.sphere === SPHERE.SHARED)
                    )
                        replaceChunk.add(one.from, one.to);
                }
        }
        const preProcessor = container.getPreProcessor();
        preProcessor.addChunk(replaceChunk);
    }

    // MAIN
    /** @type {TeqFw_Di_Api_Container} */
    const res = new Container();
    const pathNode = join(cfg.pathToRoot, 'node_modules');
    const pathDi = join(pathNode, '@teqfw', 'di', 'src');
    const pathCore = join(pathNode, '@teqfw', 'core', 'src');

    // add path mapping for @teqfw/core to the DI resolver
    const resolver = res.getResolver();
    resolver.addNamespaceRoot('TeqFw_Di_', pathDi, 'js');
    resolver.addNamespaceRoot('TeqFw_Core_', pathCore, 'mjs');
    // setup parser for the legacy code
    const chunkOld = await res.get('TeqFw_Core_Shared_App_Di_Parser_Legacy$');
    const parser = res.getParser();
    parser.addChunk(chunkOld);


    // add autoload & replaces
    /** @type {TeqFw_Core_Back_Defaults} */
    const DEF = await res.get('TeqFw_Core_Back_Defaults$');
    /** @type {TeqFw_Core_Back_App_Plugin_Loader} */
    const scan = await res.get('TeqFw_Core_Back_App_Plugin_Loader$');
    const registry = await scan.exec(cfg.pathToRoot);
    initAutoload(res, registry.items(), DEF);
    initReplaces(res, registry.getItemsByLevels(), DEF);

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
    // FUNCS
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

    // MAIN
    const filename = join(cfg.pathToRoot, './test/data/cfg/local.json');
    /** @type {TeqFw_Core_Back_Util.readJson|function} */
    const readJson = await container.get('TeqFw_Core_Back_Util.readJson');
    const local = readJson(filename);
    return local ?? generateDefault();
})(config, container);

/**
 * Use this function in tests to init DB connections.
 *
 * @param {string} db
 * @param {TeqFw_Db_Back_RDb_Connect} [conn]
 * @return {Promise<TeqFw_Db_Back_RDb_Connect>}
 * @memberOf TeqFw_Test_Back
 */
const dbConnect = async function (db = null, conn) {
    /** @type {TeqFw_Db_Back_RDb_Connect} */
    const curConn = conn ?? await container.get('TeqFw_Db_Back_RDb_Connect$$'); // instance
    switch (db) {
        case RDBMS.MARIADB:
            await curConn.init(localCfg.mariadb);
            break;
        case RDBMS.POSTGRESQL:
            await curConn.init(localCfg.pg);
            break;
        default:
            await curConn.init(localCfg.sqlite);
    }
    return curConn;
}

export {
    config,
    container,
    dbConnect,
    RDBMS,
}
