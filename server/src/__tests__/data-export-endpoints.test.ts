import { it } from '@jest/globals';
import { runNodeExportSuite } from './helpers/runNodeExportSuite.js';

it('data-export-endpoints real HTTP/database scenarios', async () => {
  await runNodeExportSuite('data-export-endpoints');
}, 45000);
