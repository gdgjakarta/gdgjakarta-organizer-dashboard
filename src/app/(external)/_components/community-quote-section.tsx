import { Quote } from "lucide-react";

export function CommunityQuoteSection() {
  return (
    <section
      className="relative overflow-hidden border-y py-20 transition-colors duration-500 lg:py-28"
      style={{
        backgroundColor: "var(--theme-bg-subtle)",
        borderColor: "var(--theme-border)",
      }}
    >
      <div className="container relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        {/* Quote Icon Badge */}
        <div
          className="mx-auto flex size-14 items-center justify-center rounded-full shadow-md"
          style={{
            backgroundColor: "var(--theme-primary)",
            color: "var(--theme-primary-foreground)",
          }}
        >
          <Quote className="size-7 fill-current" />
        </div>

        {/* Large Editorial Quote */}
        <blockquote className="mt-8 font-medium text-[24px] leading-snug tracking-tight sm:text-[36.67px] lg:text-[59.33px]">
          &ldquo;GDG Jakarta provides a vibrant space for developers and innovators to learn cutting-edge technology,
          inspire one another, and connect directly to the global Google ecosystem.&rdquo;
        </blockquote>

        {/* Author Details */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3">
          <div
            className="flex size-14 items-center justify-center rounded-full font-medium text-lg text-white shadow-md ring-2 ring-offset-2 ring-offset-background"
            style={{
              backgroundColor: "var(--theme-primary)",
              color: "var(--theme-primary-foreground)",
            }}
          >
            GDG
          </div>
          <div>
            <p className="font-medium text-[22.66px]">GDG Jakarta Organizing Team</p>
            <p className="text-muted-foreground text-[14px]">Community Leaders & Volunteers • Jakarta, Indonesia</p>
          </div>
        </div>
      </div>
    </section>
  );
}
