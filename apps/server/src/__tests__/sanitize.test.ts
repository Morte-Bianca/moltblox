import { describe, it, expect } from 'vitest';
import { sanitize, sanitizeObject } from '../lib/sanitize.js';

describe('sanitize', () => {
  it('should strip HTML tags', () => {
    expect(sanitize('<script>alert("xss")</script>')).not.toContain('<script>');
    expect(sanitize('<img src=x onerror=alert(1)>')).not.toContain('<img');
  });

  it('should escape dangerous tags', () => {
    const result = sanitize('<script>alert("xss")</script>Hello');
    expect(result).toContain('Hello');
    expect(result).not.toContain('<script>');
  });

  it('should handle nested XSS attempts', () => {
    const result = sanitize('<scr<script>ipt>alert(1)</scr</script>ipt>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
  });

  it('should handle event handler attributes', () => {
    expect(sanitize('<div onmouseover="alert(1)">test</div>')).not.toContain('onmouseover');
  });

  it('should handle javascript: protocol', () => {
    expect(sanitize('<a href="javascript:alert(1)">click</a>')).not.toContain('javascript:');
  });

  it('should handle data: protocol', () => {
    expect(sanitize('<a href="data:text/html,<script>alert(1)</script>">click</a>')).not.toContain(
      'data:',
    );
  });

  it('should handle SVG/XML attacks', () => {
    expect(sanitize('<svg onload="alert(1)"></svg>')).not.toContain('onload');
    expect(sanitize('<math><mi xlink:href="javascript:alert(1)">test</mi></math>')).not.toContain(
      'javascript:',
    );
  });

  it('should preserve plain text', () => {
    expect(sanitize('Hello, world!')).toBe('Hello, world!');
    expect(sanitize('This is a test with 123 numbers')).toBe('This is a test with 123 numbers');
  });

  it('should handle unicode and special chars', () => {
    expect(sanitize('Hello 🎮 world')).toBe('Hello 🎮 world');
    expect(sanitize('Price: $50 & 15% off')).toContain('Price: $50');
  });

  it('should handle empty and whitespace input', () => {
    expect(sanitize('')).toBe('');
    expect(sanitize('   ')).toBe('   ');
  });

  it('should handle CSS injection attempts', () => {
    expect(sanitize('<style>body{display:none}</style>')).not.toContain('<style>');
  });

  it('should handle iframe injection', () => {
    expect(sanitize('<iframe src="https://evil.com"></iframe>')).not.toContain('<iframe');
  });

  it('should handle HTML entity encoding attacks', () => {
    expect(sanitize('&#60;script&#62;alert(1)&#60;/script&#62;')).not.toContain('<script>');
  });
});

describe('sanitizeObject', () => {
  it('should sanitize specified fields', () => {
    const obj = { name: '<b>Bold</b>', description: '<script>xss</script>Clean', id: 123 };
    const result = sanitizeObject(obj as Record<string, unknown>, ['name', 'description']);
    expect(result.name).not.toContain('<b>');
    expect(result.description).toContain('Clean');
    expect(result.description).not.toContain('<script>');
    expect(result.id).toBe(123);
  });

  it('should not modify non-string fields', () => {
    const obj = { count: 42, active: true };
    const result = sanitizeObject(obj as Record<string, unknown>, ['count', 'active']);
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
  });

  it('should handle missing fields gracefully', () => {
    const obj = { name: 'hello' };
    const result = sanitizeObject(obj as Record<string, unknown>, ['name', 'missing']);
    expect(result.name).toBe('hello');
  });
});
