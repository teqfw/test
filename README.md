# teqfw/test

TeqFW: core plugin for tests.

## Usage in test scripts

```js
import {config, container, dbConnect, RDBMS} from '@teqfw/test';

const path = config.pathToRoot;
const obj = await container.get('depId');
/** @type {TeqFw_Db_Back_RDb_Connect} */
const conn = await dbConnect(RDBMS.POSTGRESQL);
```
