import { describe, expect, it } from 'vitest';
import { apiUrlForHost } from './core-api';

describe('api url for the host of the page', () => {
  it('keeps localhost on this machine and on the server', () => {
    expect(apiUrlForHost('http://localhost:4000', 'localhost')).toBe('http://localhost:4000');
    expect(apiUrlForHost('http://localhost:4000', null)).toBe('http://localhost:4000');
  });

  it('follows the page on a phone, keeping the port', () => {
    expect(apiUrlForHost('http://localhost:4000/', '192.168.1.39')).toBe('http://192.168.1.39:4000');
  });

  it('leaves a real address alone', () => {
    expect(apiUrlForHost('https://api.hira.example', '192.168.1.39')).toBe('https://api.hira.example');
  });
});
