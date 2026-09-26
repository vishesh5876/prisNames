/**
 * Admin navigation capability configuration.
 *
 * Single source of truth for which nav items are visible to which roles.
 * Frontend visibility only — backend RBAC is authoritative.
 *
 * No numeric role hierarchy. Capability-based matching per item.
 */

import {
  Users, Globe, ShoppingBag, CreditCard, ReceiptText, FileText,
  Radio, DollarSign, Layers, ArrowRightLeft, RotateCw,
  ShieldAlert, Scale, ScrollText, Mail, Settings, Lock,
} from 'lucide-react';
import type { Role } from '@prisnames/contracts';
import { ROLES } from '@prisnames/contracts';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Roles that can see this nav item. SUPER_ADMIN always sees everything. */
  visibleTo: readonly Role[];
}

export interface AdminNavSection {
  heading?: string;
  items: AdminNavItem[];
}

const { SUPPORT, FINANCE, ABUSE, ADMIN, SUPER_ADMIN } = ROLES;

export const ADMIN_NAV: AdminNavSection[] = [
  {
    items: [
      { label: 'Users', href: '/admin/users', icon: Users, visibleTo: [SUPPORT, ADMIN, SUPER_ADMIN] },
      { label: 'Domains', href: '/admin/domains', icon: Globe, visibleTo: [SUPPORT, ADMIN, SUPER_ADMIN] },
    ],
  },
  {
    heading: 'Commerce',
    items: [
      { label: 'Orders', href: '/admin/orders', icon: ShoppingBag, visibleTo: [SUPPORT, FINANCE, ADMIN, SUPER_ADMIN] },
      { label: 'Payments', href: '/admin/payments', icon: CreditCard, visibleTo: [FINANCE, ADMIN, SUPER_ADMIN] },
      { label: 'Refunds', href: '/admin/refunds', icon: ReceiptText, visibleTo: [FINANCE, ADMIN, SUPER_ADMIN] },
      { label: 'Invoices', href: '/admin/invoices', icon: FileText, visibleTo: [FINANCE, ADMIN, SUPER_ADMIN] },
    ],
  },
  {
    heading: 'Registry',
    items: [
      { label: 'Registrars', href: '/admin/registrars', icon: Radio, visibleTo: [ADMIN, SUPER_ADMIN] },
      { label: 'Pricing', href: '/admin/pricing', icon: DollarSign, visibleTo: [FINANCE, ADMIN, SUPER_ADMIN] },
      { label: 'TLDs', href: '/admin/tlds', icon: Layers, visibleTo: [ADMIN, SUPER_ADMIN] },
      { label: 'Transfers', href: '/admin/transfers', icon: ArrowRightLeft, visibleTo: [SUPPORT, ADMIN, SUPER_ADMIN] },
      { label: 'Renewals', href: '/admin/renewals', icon: RotateCw, visibleTo: [SUPPORT, ADMIN, SUPER_ADMIN] },
    ],
  },
  {
    heading: 'Compliance',
    items: [
      { label: 'Abuse', href: '/admin/abuse', icon: ShieldAlert, visibleTo: [ABUSE, ADMIN, SUPER_ADMIN] },
      { label: 'Compliance', href: '/admin/compliance', icon: Scale, visibleTo: [ABUSE, ADMIN, SUPER_ADMIN] },
    ],
  },
  {
    heading: 'System',
    items: [
      { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText, visibleTo: [ADMIN, SUPER_ADMIN] },
      { label: 'Emails', href: '/admin/emails', icon: Mail, visibleTo: [ADMIN, SUPER_ADMIN] },
      { label: 'Settings', href: '/admin/settings', icon: Settings, visibleTo: [ADMIN, SUPER_ADMIN] },
      { label: 'Security', href: '/admin/security', icon: Lock, visibleTo: [ADMIN, SUPER_ADMIN] },
    ],
  },
];

/**
 * Filter admin nav items by user roles.
 * SUPER_ADMIN always sees all items.
 */
export function getVisibleAdminNav(userRoles: string[]): AdminNavSection[] {
  const isSuperAdmin = userRoles.includes(SUPER_ADMIN);

  return ADMIN_NAV
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => isSuperAdmin || item.visibleTo.some((role) => userRoles.includes(role)),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
