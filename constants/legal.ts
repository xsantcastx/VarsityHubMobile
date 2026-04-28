import { getConfig } from '@/config/env';

const PUBLIC_APP_BASE_URL = getConfig().webBaseUrl;

export const PUBLIC_TERMS_URL = `${PUBLIC_APP_BASE_URL}/terms`;
export const PUBLIC_PRIVACY_POLICY_URL = `${PUBLIC_APP_BASE_URL}/privacy-policy`;
