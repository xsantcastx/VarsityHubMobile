import { it } from '@jest/globals';
import { runNodeExportSuite } from './helpers/runNodeExportSuite.js';

it('data-export-lifecycle real HTTP/database scenarios', async () => {
  await runNodeExportSuite('data-export-lifecycle');
}, 45000);
