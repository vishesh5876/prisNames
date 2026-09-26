import Link from 'next/link';
import { Button } from '@prisnames/ui';

export default function HomePage() {

  return (
    <>
      {/* ─── Hero Section ────────────────────────────── */}
      <section className="bg-[var(--color-teal-deep)] text-[var(--color-on-dark)]">
        <div className="mx-auto max-w-[var(--container-max)] px-4 lg:px-8 py-20 md:py-28 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight leading-[1.1] mb-4">
            Your domain,
            <br />
            <span className="text-[var(--color-brand-green)]">secured.</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-on-dark-muted)] max-w-2xl mx-auto mb-8">
            Find, register, and manage domains with transparent pricing and no hidden fees.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup">
              <Button variant="on-dark" size="lg">Get Started</Button>
            </Link>
            <Link href="/domains">
              <Button variant="secondary-on-dark" size="lg">Explore Domains</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Value Props ─────────────────────────────── */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-[var(--container-max)] px-4 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Transparent Pricing',
                description: 'No hidden fees, no surprise renewals. See the real price upfront.',
              },
              {
                title: 'Full Control',
                description: 'DNS management, domain forwarding, WHOIS privacy — all included.',
              },
              {
                title: 'Secure by Default',
                description: 'Two-factor authentication, domain locking, and transfer protection.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-6 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:shadow-[var(--shadow-card)] transition-shadow"
              >
                <h3 className="text-base font-medium text-[var(--color-ink)] mb-2">{item.title}</h3>
                <p className="text-sm text-[var(--color-steel)] leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─────────────────────────────── */}
      <section className="bg-[var(--color-surface)] py-16">
        <div className="mx-auto max-w-[var(--container-max)] px-4 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-medium text-[var(--color-ink)] mb-3">
            Ready to claim your domain?
          </h2>
          <p className="text-[var(--color-steel)] mb-6">
            Create a free account and start managing your domains today.
          </p>
          <Link href="/signup">
            <Button variant="primary" size="lg">Create Account</Button>
          </Link>
        </div>
      </section>
    </>
  );
}
