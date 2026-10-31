import { describe, expect, it } from 'vitest';
import { apiUrlForPage } from './core-api';

const page = (origin: string) => {
  const url = new URL(origin);
  return { hostname: url.hostname, protocol: url.protocol, origin: url.origin };
};

describe('api url for the page', () => {
  it('keeps localhost on this machine and on the server', () => {
    expect(apiUrlForPage('http://localhost:4000', page('http://localhost:3000'))).toBe('http://localhost:4000');
    expect(apiUrlForPage('http://localhost:4000', null)).toBe('http://localhost:4000');
  });

  it('follows the page on a phone over http, keeping the API port', () => {
    expect(apiUrlForPage('http://localhost:4000/', page('http://192.168.1.39:3000'))).toBe('http://192.168.1.39:4000');
  });

  it('uses the address of the page over https, where the proxy serves the API', () => {
    expect(apiUrlForPage('http://localhost:4000', page('https://192.168.1.39:3443'))).toBe('https://192.168.1.39:3443');
    expect(apiUrlForPage('http://localhost:4000', page('https://localhost:3443'))).toBe('https://localhost:3443');
  });

  it('leaves a real address alone', () => {
    expect(apiUrlForPage('https://api.hira.example', page('https://192.168.1.39:3443'))).toBe('https://api.hira.example');
  });
});
