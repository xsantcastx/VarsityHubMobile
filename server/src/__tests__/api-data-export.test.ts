import { it } from '@jest/globals';
import { runNodeExportSuite } from './helpers/runNodeExportSuite.js';

it('api-data-export real HTTP/database scenarios', async () => {
  await runNodeExportSuite('api-data-export');
}, 45000);
