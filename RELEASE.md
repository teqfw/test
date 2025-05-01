# @teqfw/test: Releases

## 0.24.0 – Unified DI container types and test environment cleanup

- Replaced legacy `TeqFw_Di_Api_Container` type with updated `TeqFw_Di_Container` across all internal JSDoc annotations
  for consistency and alignment with DI implementation.
- Updated test environment initialization to reflect consistent container handling in `Back/Index.mjs` and related
  functions.
 
## 0.23.0 - Plugin Integration and DB Enhancements

* Added dependencies to `package.json` for smoother integration.
* Enhanced database connection initialization for tests.
* Improved logger initialization in the test environment.

## 0.22.0

* Added support for `better-sqlite3` as a database type.
* Added proxy and logger post-processors.

## 0.21.0

* Use a new depId scheme from @teqfw/di.

## 0.20.1

* Use pre- and post-processors in the test env initialization.

## 0.20.0

* These changes are related to the new architecture of the `@teqfw/di` package.

## 0.3.0

* Core refactoring reflection.

## 0.2.0

* SQLite support.
* Switch source code areas enum from `di` to `core` plugin.

## 0.1.0

* Initial.
