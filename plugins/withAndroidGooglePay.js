const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const {
  addMetaDataItemToMainApplication,
  getMainApplicationOrThrow,
  removeMetaDataItemFromMainApplication,
} = AndroidConfig.Manifest;

const GOOGLE_PAY_META_NAME = 'com.google.android.gms.wallet.api.enabled';

function withAndroidGooglePay(config, { enabled = true } = {}) {
  return withAndroidManifest(config, (mod) => {
    const mainApplication = getMainApplicationOrThrow(mod.modResults);
    if (enabled) {
      addMetaDataItemToMainApplication(mainApplication, GOOGLE_PAY_META_NAME, 'true');
    } else {
      removeMetaDataItemFromMainApplication(mainApplication, GOOGLE_PAY_META_NAME);
    }
    return mod;
  });
}

module.exports = withAndroidGooglePay;
