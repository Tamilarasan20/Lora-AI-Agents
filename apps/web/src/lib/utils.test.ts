import { cn, formatNumber, formatDate, formatRelative, PLATFORM_ICONS, PLATFORM_COLORS, STATUS_COLORS } from './utils';

describe('cn (classname merger)', () => {
  it('merges class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'no', 'yes')).toBe('base yes');
  });

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    const result = cn('px-2', 'px-4');
    expect(result).toBe('px-4');
  });

  it('handles undefined/null gracefully', () => {
    expect(cn('base', undefined, null as any)).toBe('base');
  });
});

describe('formatNumber', () => {
  it('formats numbers below 1000 as-is', () => {
    expect(formatNumber(500)).toBe('500');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(10000)).toBe('10.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(1_500_000)).toBe('1.5M');
  });

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatDate', () => {
  it('formats a date string', () => {
    const result = formatDate('2025-01-15T10:00:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formats a Date object', () => {
    const result = formatDate(new Date('2025-06-01'));
    expect(typeof result).toBe('string');
  });
});

describe('formatRelative', () => {
  it('returns "just now" for very recent dates', () => {
    const now = new Date().toISOString();
    const result = formatRelative(now);
    expect(result).toMatch(/just now|seconds? ago|<1m/i);
  });

  it('returns a relative string for older dates', () => {
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
    const result = formatRelative(past);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('PLATFORM_ICONS', () => {
  it('has icons for all major platforms', () => {
    const platforms = ['instagram', 'twitter', 'linkedin', 'tiktok', 'facebook', 'youtube'];
    platforms.forEach((p) => {
      expect(PLATFORM_ICONS[p]).toBeTruthy();
    });
  });
});

describe('PLATFORM_COLORS', () => {
  it('has colors for all major platforms', () => {
    const platforms = ['instagram', 'twitter', 'linkedin'];
    platforms.forEach((p) => {
      expect(PLATFORM_COLORS[p]).toMatch(/^#/);
    });
  });
});

describe('STATUS_COLORS', () => {
  it('has color classes for content statuses', () => {
    const statuses = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED'];
    statuses.forEach((s) => {
      expect(STATUS_COLORS[s]).toBeTruthy();
    });
  });
});
