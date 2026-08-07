import { describe, expect, it } from 'vitest';
import { sanitizeInquiryHref } from './inquiryLinkUtils';

describe('inquiry link helpers', () => {
  it('allows http, https, root-relative, and local storage paths', () => {
    expect(sanitizeInquiryHref('https://example.com/file.pdf')).toBe('https://example.com/file.pdf');
    expect(sanitizeInquiryHref('http://example.com/file.pdf')).toBe('http://example.com/file.pdf');
    expect(sanitizeInquiryHref('/attachments/file.pdf')).toBe('/attachments/file.pdf');
    expect(sanitizeInquiryHref('storage/inquiries/file.pdf')).toBe('storage/inquiries/file.pdf');
  });

  it('blocks scriptable, placeholder, query-only, and empty hrefs from inquiry data', () => {
    expect(sanitizeInquiryHref('javascript:alert(1)')).toBeNull();
    expect(sanitizeInquiryHref('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(sanitizeInquiryHref('#')).toBeNull();
    expect(sanitizeInquiryHref('#details')).toBeNull();
    expect(sanitizeInquiryHref('?x=1')).toBeNull();
    expect(sanitizeInquiryHref('')).toBeNull();
    expect(sanitizeInquiryHref(undefined)).toBeNull();
  });
});
