import type { Metadata } from "next";

import { PartnerVoucherReportView } from "./_components/partner-voucher-report-view";

export const metadata: Metadata = {
  title: "Partner Voucher Redemption Report | GDG Jakarta",
  description: "Live partner and sponsor voucher redemption analytics with masked PII.",
  robots: {
    index: false,
    follow: false,
  },
};

interface PageProps {
  params: Promise<{
    shareToken: string;
  }>;
}

export default async function PartnerVoucherReportPage({ params }: PageProps) {
  const { shareToken } = await params;

  return <PartnerVoucherReportView shareToken={shareToken} />;
}
