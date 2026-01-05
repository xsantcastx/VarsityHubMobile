describe('App Launch', () => {
  it('should launch the app', async () => {
    await device.launchApp();
    await expect(element(by.id('app-root'))).toBeVisible();
  });
});
