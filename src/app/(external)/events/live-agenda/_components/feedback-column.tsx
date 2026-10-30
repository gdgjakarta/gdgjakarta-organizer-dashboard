import Image from "next/image";

import { LIVE_AGENDA_FEEDBACK_URL } from "@/lib/events/live-agenda";
import { generateQrSvgDataUrl } from "@/lib/printers/qr-svg";

interface FeedbackColumnProps {
  eventName: string;
}

const FEEDBACK_QR_DATA_URL = generateQrSvgDataUrl(LIVE_AGENDA_FEEDBACK_URL);

export function FeedbackColumn({ eventName }: FeedbackColumnProps) {
  return (
    <section
      aria-label="Feedback form"
      className="flex flex-col items-center justify-center gap-6 text-center lg:col-start-3 lg:row-start-1"
    >
      <h2 className="text-balance font-bold text-2xl text-shadow-[0_2px_16px] text-shadow-black/50 leading-tight tracking-tight">
        Thank you for attending {eventName || "our event"}
      </h2>

      <a
        href={LIVE_AGENDA_FEEDBACK_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open the feedback form"
        className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 text-green-700 shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-white/60"
      >
        <Image
          src={FEEDBACK_QR_DATA_URL}
          alt="QR code to the feedback form"
          width={256}
          height={256}
          unoptimized
          className="size-56 sm:size-64"
        />
        <span className="font-medium text-sm">{LIVE_AGENDA_FEEDBACK_URL.replace(/^https?:\/\//, "")}</span>
      </a>

      <h3 className="text-balance font-medium text-base text-shadow-[0_2px_16px] text-shadow-black/50 text-white/90">
        Please take a moment to fill our feedback form
      </h3>
    </section>
  );
}
