import Link from 'next/link';

interface FooterProps {
  siteName: string;
  operator: string;
}

export function Footer({ siteName, operator }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--color-teal-deep)] text-[var(--color-on-dark-muted)]">
      <div className="mx-auto max-w-[var(--container-max)] px-4 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Products */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-on-dark)] mb-3">Products</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/domains" className="hover:text-[var(--color-on-dark)] transition-colors">Domains</Link></li>
              <li><Link href="/transfer" className="hover:text-[var(--color-on-dark)] transition-colors">Transfer</Link></li>
              <li><Link href="/whois" className="hover:text-[var(--color-on-dark)] transition-colors">WHOIS</Link></li>
              <li><Link href="/pricing" className="hover:text-[var(--color-on-dark)] transition-colors">Pricing</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-on-dark)] mb-3">Account</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/login" className="hover:text-[var(--color-on-dark)] transition-colors">Sign In</Link></li>
              <li><Link href="/signup" className="hover:text-[var(--color-on-dark)] transition-colors">Create Account</Link></li>
              <li><Link href="/dashboard" className="hover:text-[var(--color-on-dark)] transition-colors">Dashboard</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-on-dark)] mb-3">Company</h3>
            <ul className="space-y-2 text-sm">
              <li><span className="opacity-50">About</span></li>
              <li><span className="opacity-50">Terms</span></li>
              <li><span className="opacity-50">Privacy</span></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-on-dark)] mb-3">Support</h3>
            <ul className="space-y-2 text-sm">
              <li><span className="opacity-50">Help Center</span></li>
              <li><span className="opacity-50">Contact</span></li>
              <li><span className="opacity-50">Status</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[var(--color-hairline-dark)] mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          <p>&copy; {year} {operator}. All rights reserved.</p>
          <p className="text-[var(--color-on-dark)]">{siteName}</p>
        </div>
      </div>
    </footer>
  );
}
