import { createOtaReloadRequest } from '../otaReload';

describe('OTA reload requests', () => {
  it('coalesces a pending-update notification and download completion', async () => {
    let finish!: () => void;
    const reload = jest.fn(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        })
    );
    const request = createOtaReloadRequest(reload, jest.fn());
    const pendingNotification = request();
    const downloadCompletion = request();
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);
    finish();
    await expect(pendingNotification).resolves.toBe(true);
    await expect(downloadCompletion).resolves.toBe(true);
    await request();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reports a failed shared attempt once and allows a later retry', async () => {
    const failure = new Error('Native reload rejected');
    const reload = jest.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    const report = jest.fn();
    const request = createOtaReloadRequest(reload, report);
    expect(await Promise.all([request(), request()])).toEqual([false, false]);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(failure);
    await expect(request()).resolves.toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('handles a synchronous native failure without leaving the reload latched', async () => {
    const reload = jest.fn(() => {
      throw new Error('Native unavailable');
    });
    const report = jest.fn();
    const request = createOtaReloadRequest(reload, report);
    await expect(request()).resolves.toBe(false);
    await expect(request()).resolves.toBe(false);
    expect(reload).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenCalledTimes(2);
  });
});
