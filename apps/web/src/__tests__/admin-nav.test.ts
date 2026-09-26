/**
 * Admin navigation config tests.
 *
 * Covers: capability-based filtering, SUPER_ADMIN sees all,
 * role-specific visibility, empty sections removed.
 */
import { describe, it, expect } from 'vitest';
import { getVisibleAdminNav, ADMIN_NAV } from '@/components/layout/admin-nav-config';

describe('getVisibleAdminNav', () => {
  it('SUPER_ADMIN sees all nav items', () => {
    const nav = getVisibleAdminNav(['SUPER_ADMIN']);
    const totalItems = nav.reduce((sum, section) => sum + section.items.length, 0);
    const allItems = ADMIN_NAV.reduce((sum, section) => sum + section.items.length, 0);
    expect(totalItems).toBe(allItems);
  });

  it('SUPPORT sees only support-visible items', () => {
    const nav = getVisibleAdminNav(['SUPPORT']);
    const allItems = nav.flatMap((s) => s.items);

    // Support should see Users, Domains, Orders, Transfers, Renewals
    const labels = allItems.map((i) => i.label);
    expect(labels).toContain('Users');
    expect(labels).toContain('Domains');
    expect(labels).toContain('Orders');
    expect(labels).toContain('Transfers');
    expect(labels).toContain('Renewals');

    // Support should NOT see Payments, Registrars, Audit Logs, Settings
    expect(labels).not.toContain('Payments');
    expect(labels).not.toContain('Registrars');
    expect(labels).not.toContain('Audit Logs');
    expect(labels).not.toContain('Settings');
  });

  it('FINANCE sees commerce items', () => {
    const nav = getVisibleAdminNav(['FINANCE']);
    const labels = nav.flatMap((s) => s.items).map((i) => i.label);

    expect(labels).toContain('Orders');
    expect(labels).toContain('Payments');
    expect(labels).toContain('Refunds');
    expect(labels).toContain('Invoices');
    expect(labels).toContain('Pricing');

    // Finance should NOT see Users, Domains, Registrars
    expect(labels).not.toContain('Users');
    expect(labels).not.toContain('Domains');
    expect(labels).not.toContain('Registrars');
  });

  it('ABUSE sees compliance items', () => {
    const nav = getVisibleAdminNav(['ABUSE']);
    const labels = nav.flatMap((s) => s.items).map((i) => i.label);

    expect(labels).toContain('Abuse');
    expect(labels).toContain('Compliance');
    expect(labels).not.toContain('Users');
    expect(labels).not.toContain('Payments');
  });

  it('ADMIN sees most items', () => {
    const nav = getVisibleAdminNav(['ADMIN']);
    const labels = nav.flatMap((s) => s.items).map((i) => i.label);

    expect(labels).toContain('Users');
    expect(labels).toContain('Audit Logs');
    expect(labels).toContain('Settings');
    expect(labels).toContain('Registrars');
    expect(labels).toContain('Payments');
  });

  it('USER role with no staff access sees nothing', () => {
    const nav = getVisibleAdminNav(['USER']);
    const totalItems = nav.reduce((sum, section) => sum + section.items.length, 0);
    expect(totalItems).toBe(0);
  });

  it('empty roles see nothing', () => {
    const nav = getVisibleAdminNav([]);
    expect(nav).toHaveLength(0);
  });

  it('removes empty sections', () => {
    const nav = getVisibleAdminNav(['ABUSE']);
    // All returned sections should have items
    nav.forEach((section) => {
      expect(section.items.length).toBeGreaterThan(0);
    });
  });

  it('multi-role user gets combined visibility', () => {
    const nav = getVisibleAdminNav(['SUPPORT', 'FINANCE']);
    const labels = nav.flatMap((s) => s.items).map((i) => i.label);

    // Should see both support and finance items
    expect(labels).toContain('Users');      // SUPPORT
    expect(labels).toContain('Payments');    // FINANCE
    expect(labels).toContain('Pricing');     // FINANCE
    expect(labels).toContain('Orders');      // Both
  });
});
