import { getSiteConfig } from '@prisnames/config';
import { Header } from '@/components/layout/header';

/**
 * Auth layout — minimal header, no footer, centered content.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const site = getSiteConfig();

  return (
    <>
      <Header siteName={site.name} />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          {children}
        </div>
      </main>
    </>
  );
}
