import type { ReactNode } from "react";

import { PublicFooter } from "./_components/public-footer";
import { PublicHeader } from "./_components/public-header";

export default function ExternalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
