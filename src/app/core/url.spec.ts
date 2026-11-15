import { hostnameOf, isBlank, isUnsafeUrl, normalizeUrl } from './url';

describe('normalizeUrl', () => {
  it('adds https:// to a bare domain', () => {
    expect(normalizeUrl('github.com')).toBe('https://github.com');
  });

  it.each([
    'http://x',
    'https://x.com/a',
    'file:///C:/a',
    'C:\\a',
    'C:/a',
    '/usr/a',
    './a',
    'about:blank',
    'chrome://extensions',
  ])('keeps %s unchanged', (url) => {
    expect(normalizeUrl(url)).toBe(url);
  });
});

describe('isUnsafeUrl', () => {
  it.each([' JavaScript:alert(1)', 'data:text/html,x', 'VBScript:msgbox'])('flags %s', (url) => {
    expect(isUnsafeUrl(url)).toBe(true);
  });

  it.each(['https://a', 'mailto:a@b', 'file:///C:/a', 'brave://settings', ''])('allows %s', (url) => {
    expect(isUnsafeUrl(url)).toBe(false);
  });
});

describe('hostnameOf', () => {
  it('returns the hostname of an http url', () => {
    expect(hostnameOf('https://www.figma.com/file/1')).toBe('www.figma.com');
  });

  it('returns empty string for an unparsable url', () => {
    expect(hostnameOf('52.0.205.252')).toBe('');
  });
});

describe('isBlank', () => {
  it.each(['', '   ', null, undefined])('treats %p as blank', (v) => {
    expect(isBlank(v)).toBe(true);
  });

  it('treats text as not blank', () => {
    expect(isBlank(' a ')).toBe(false);
  });
});
