import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src', 'routes', 'adminReports.ts'), 'utf8');

describe('admin reports race guards', () => {
  it('stops email review actions when a report is already in a final status', () => {
    expect(src).toContain("const FINAL_REPORT_STATUSES = ['resolved', 'dismissed'] as const;");
    expect(src).toMatch(/if \(report\.status === 'resolved' \|\| report\.status === 'dismissed'\)/);
  });

  it('guards email review transitions with updateMany so final states cannot be overwritten', () => {
    expect(src).toMatch(
      /abuseReport\.updateMany\(\{\s*where: \{ id, status: \{ notIn: \[\.\.\.FINAL_REPORT_STATUSES\] \} \}/
    );
  });

  it('guards admin patch and bulk-update routes against overwriting final states', () => {
    expect(src).toMatch(
      /abuseReport\.updateMany\(\{[\s\S]*?where: \{ id, status: \{ notIn: \[\.\.\.FINAL_REPORT_STATUSES\] \} \}/
    );
    expect(src).toMatch(
      /abuseReport\.updateMany\(\{[\s\S]*?id: \{ in: report_ids \},[\s\S]*?status: \{ notIn: \[\.\.\.FINAL_REPORT_STATUSES\] \}/
    );
  });
});
