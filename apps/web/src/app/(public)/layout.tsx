import { getSiteConfig } from '@prisnames/config';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const site = getSiteConfig();

  return (
    <>
      <Header siteName={site.name} />
      <main className="flex-1">
        {children}
      </main>
      <Footer siteName={site.name} operator={site.operator} />
    </>
  );
}
