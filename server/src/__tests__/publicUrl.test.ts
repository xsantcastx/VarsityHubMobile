import { describe, expect, it } from '@jest/globals';
import { isPublicHttpUrl } from '../lib/publicUrl.js';

describe('isPublicHttpUrl', () => {
  it('accepts ordinary public http(s) URLs', () => {
    expect(isPublicHttpUrl('https://example.com')).toBe(true);
    expect(isPublicHttpUrl('https://subdomain.example.com/path?q=1')).toBe(true);
    expect(isPublicHttpUrl('http://8.8.8.8/landing')).toBe(true);
  });

  it('rejects non-http(s) schemes', () => {
    expect(isPublicHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isPublicHttpUrl('data:text/html;base64,SGk=')).toBe(false);
    expect(isPublicHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isPublicHttpUrl('intent://example.com')).toBe(false);
  });

  it('rejects loopback, private, link-local, and reserved IPv4 addresses', () => {
    expect(isPublicHttpUrl('http://127.0.0.1')).toBe(false);
    expect(isPublicHttpUrl('http://10.0.0.12')).toBe(false);
    expect(isPublicHttpUrl('http://172.16.10.20')).toBe(false);
    expect(isPublicHttpUrl('http://192.168.1.12')).toBe(false);
    expect(isPublicHttpUrl('http://169.254.1.10')).toBe(false);
    expect(isPublicHttpUrl('http://0.0.0.0')).toBe(false);
    expect(isPublicHttpUrl('http://224.0.0.1')).toBe(false);
  });

  it('rejects local, ULA, link-local, and reserved IPv6 addresses', () => {
    expect(isPublicHttpUrl('http://[::1]')).toBe(false);
    expect(isPublicHttpUrl('http://[::]')).toBe(false);
    expect(isPublicHttpUrl('http://[fe80::1]')).toBe(false);
    expect(isPublicHttpUrl('http://[fd12:3456:789a::1]')).toBe(false);
    expect(isPublicHttpUrl('http://[2001:db8::1]')).toBe(false);
    expect(isPublicHttpUrl('http://[2606:4700:4700::1111]')).toBe(true);
  });

  it('rejects obvious internal hostnames', () => {
    expect(isPublicHttpUrl('https://localhost')).toBe(false);
    expect(isPublicHttpUrl('https://api.local')).toBe(false);
    expect(isPublicHttpUrl('https://db.internal')).toBe(false);
    expect(isPublicHttpUrl('https://corp.home.arpa')).toBe(false);
  });
});
