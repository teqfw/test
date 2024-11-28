/**
 * This ES6 module creates a test environment for TeqFW plugins and projects.
 * @namespace TeqFw_Test_Back_Index
 */
import Config from './Dto/Config.mjs';
import Container from '@teqfw/di';
import {dirname, join} from 'path';

// VARS
/**
 * The registry for the TeqFW plugins of the project.
 * @type {TeqFw_Core_Back_Api_Plugin_Registry}
 */
let PLUGINS;

/**
 * Config DTO with the path to the project root.
 * @type {TeqFw_Test_Back_Dto_Config}
 */
const config = initConfig();
/**
 * Create and set up the DI container (once for all imports).
 * @type {TeqFw_Di_Api_Container}
 */
const container = await createContainer();

// FUNCS

/**
 * Factory function to create and configure the DI container.
 * @return {Promise<TeqFw_Di_Api_Container>}
 */
async function createContainer() {
    // FUNCS

    /**
     * Extract autoload data from `@teqfw/di` nodes of TeqFW descriptors and initialize resolver.
     * @param {TeqFw_Di_Api_Container} container
     * @param {TeqFw_Core_Back_Api_Dto_Plugin_Registry_Item[]} items
     */
    async function initNamespaces(container, items) {
        /** @type {TeqFw_Di_Container_Resolver} */
        const resolver = container.getResolver();
        /** @type {TeqFw_Core_Back_Defaults} */
        const DEF = await container.get('TeqFw_Core_Back_Defaults$');
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
     * Initialize the legacy parser.
     * @param {TeqFw_Di_Api_Container} container
     */
    async function initParserLegacy(container) {
        const legacyChunk = await container.get('TeqFw_Core_Shared_App_Di_Parser_Legacy$');
        const parser = container.getParser();
        parser.addChunk(legacyChunk);
    }

    /**
     * Add the logger chunk for the post processor.
     * @param {TeqFw_Di_Api_Container} container
     */
    async function initPostLogger(container) {
        const loggerChunk = await container.get('TeqFw_Core_Shared_App_Di_PostProcessor_Logger$');
        const postProcessor = container.getPostProcessor();
        postProcessor.addChunk(loggerChunk);
    }


    /**
     * Initialize replacements in the pre-processor.
     * @param {TeqFw_Di_Api_Container} container
     * @param {TeqFw_Core_Back_Api_Dto_Plugin_Registry_Item[]} items
     */
    async function initPreReplaces(container, items) {
        /** @type {TeqFw_Core_Back_Defaults} */
        const DEF = await container.get('TeqFw_Core_Back_Defaults$');
        /** @type {typeof TeqFw_Core_Shared_Enum_Sphere} */
        const SPHERE = await container.get('TeqFw_Core_Shared_Enum_Sphere.default');
        /** @type {TeqFw_Core_Shared_App_Di_PreProcessor_Replace} */
        const replaceChunk = await container.get('TeqFw_Core_Shared_App_Di_PreProcessor_Replace$');
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
        container.getPreProcessor().addChunk(replaceChunk);
    }

    /**
     * Initialize proxies in the post-processor.
     * @param {TeqFw_Di_Api_Container} container
     * @param {TeqFw_Core_Back_Api_Dto_Plugin_Registry_Item[]} items
     */
    async function initPostProxy(container, items) {
        /** @type {TeqFw_Core_Back_Defaults} */
        const DEF = await container.get('TeqFw_Core_Back_Defaults$');
        /** @type {typeof TeqFw_Core_Shared_Enum_Sphere} */
        const SPHERE = await container.get('TeqFw_Core_Shared_Enum_Sphere.default');
        /** @type {TeqFw_Core_Shared_App_Di_PostProcessor_Proxy} */
        const proxyChunk = await container.get('TeqFw_Core_Shared_App_Di_PostProcessor_Proxy$');
        for (const item of items) {
            /** @type {TeqFw_Core_Back_Plugin_Dto_Desc_Di.Dto} */
            const desc = item.teqfw[DEF.SHARED.NAME_DI];
            if (Array.isArray(desc?.proxy))
                for (const one of desc.proxy) {
                    if (
                        (one.sphere === SPHERE.BACK) ||
                        (one.sphere === SPHERE.SHARED)
                    )
                        proxyChunk.map(one.from, one.to);
                }
        }
        container.getPostProcessor().addChunk(proxyChunk);
    }


    // MAIN
    // set up paths to the main folders
    const pathNode = join(config.pathToRoot, 'node_modules');
    const pathDi = join(pathNode, '@teqfw', 'di', 'src');
    const pathCore = join(pathNode, '@teqfw', 'core', 'src');

    // create the container and set up namespaces for @teqfw/di & @teqfw/core
    /** @type {TeqFw_Di_Api_Container} */
    const container = new Container();
    const resolver = container.getResolver();
    resolver.addNamespaceRoot('TeqFw_Di_', pathDi, 'js');
    resolver.addNamespaceRoot('TeqFw_Core_', pathCore, 'mjs');

    // set up parser for old-style code
    await initParserLegacy(container);
    // Set up the logger chunk for post processor (add namespace to a logger instance).
    await initPostLogger(container);

    // get plugins registry
    const registry = await loadPlugins(container, config);
    const plugins = registry.items();
    const pluginsOrdered = registry.getItemsByLevels();

    // loop all plugins and set up namespaces and autoload
    await initNamespaces(container, plugins);
    // set up the namespaces replaces in preprocessor
    await initPreReplaces(container, pluginsOrdered);
    // set up proxy wrappers in postprocessor
    await initPostProxy(container, pluginsOrdered);

    return container;
}

/**
 * Creates a configuration DTO for the test environment.
 * Pins the project folder containing the `./node_modules/` subfolder.
 *
 * @return {TeqFw_Test_Back_Dto_Config}
 */
function initConfig() {
    const res = new Config();
    const scriptPath = dirname(new URL(import.meta.url).pathname);
    res.pathToRoot = join(scriptPath, '..', '..', '..', '..', '..');
    return res;
}

/**
 * Load the plugins registry.
 * @param {TeqFw_Di_Api_Container} container
 * @param {TeqFw_Test_Back_Dto_Config} cfgDto
 * @return {Promise<TeqFw_Core_Back_Api_Plugin_Registry>}
 */
async function loadPlugins(container, cfgDto) {
    if (!PLUGINS) {
        /** @type {TeqFw_Core_Back_App_Plugin_Loader} */
        const scan = await container.get('TeqFw_Core_Back_App_Plugin_Loader$');
        PLUGINS = await scan.exec(cfgDto.pathToRoot);
    } else {
        /** @type {TeqFw_Core_Back_Api_Plugin_Registry} */
        const reg = await container.get('TeqFw_Core_Back_Api_Plugin_Registry$');
        for (const item of PLUGINS.items()) {
            reg.set(item.name, item);
        }
    }
    return PLUGINS;
}

// MAIN

/**
 * RDBMS types codifier.
 * @memberOf TeqFw_Test_Back_Index
 */
const RDBMS = {
    MARIADB: 'mariadb',
    POSTGRESQL: 'pg',
    SQLITE: 'sqlite',
    SQLITE_BETTER: 'sqlite_better',
};

/**
 * Load the local configuration (./test/data/cfg/local.json).
 * @typedef {Object}
 */
const localCfg = await (async function (cfg, container) {
    // FUNCS
    /**
     * Default connection parameters to PostgreSQL/MariaDB/MySQL/SQLite database.
     * Override these params in local configuration (./test/data/cfg/local.json).
     *
     * @returns {Object}
     */
    function generateDefault() {
        const connDef = {
            database: 'teqfw_db_test',
            host: '127.0.0.1',
            password: 'PasswordToConnectToTeqFWDb',
            user: 'teqfw'
        };
        const connSqlite = {
            filename: join(cfg.pathToRoot, './test/data/db.sqlite3'),
        };
        return {
            mariadb: {client: 'mysql2', connection: connDef},
            pg: {client: 'pg', connection: connDef},
            sqlite: {
                client: 'sqlite3',
                connection: connSqlite,
                useNullAsDefault: true,
            },
            sqliteBetter: {
                client: 'better-sqlite3',
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
 * Initialize DB connections for tests.
 * @param {string} db
 * @param {TeqFw_Db_Back_RDb_Connect} [conn]
 * @return {Promise<TeqFw_Db_Back_RDb_Connect>}
 */
const dbConnect = async (db = RDBMS.SQLITE_BETTER, conn) => {
    const connections = {
        [RDBMS.MARIADB]: localCfg.mariadb,
        [RDBMS.POSTGRESQL]: localCfg.pg,
        [RDBMS.SQLITE]: localCfg.sqlite,
        [RDBMS.SQLITE_BETTER]: localCfg.sqliteBetter,
    };
    const curConn = conn ?? await container.get('TeqFw_Db_Back_RDb_Connect$$');
    await curConn.init(connections[db]);
    return curConn;
};

export {
    createContainer,
    RDBMS,
    /**
     * Use `configDto`.
     * @deprecated
     */
        config,
    config as configDto,
    container,
    dbConnect,
};
