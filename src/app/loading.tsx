import { GdgLogo } from "@/components/gdg-logo";
import { Spinner } from "@/components/ui/spinner";

export default function RootLoading() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 p-8">
      <div className="relative flex items-center justify-center">
        <GdgLogo size={64} className="h-10 w-auto animate-pulse" />
      </div>
      <div className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
        <Spinner className="size-4 animate-spin text-primary" />
        <span>Loading GDG Jakarta...</span>
      </div>
    </div>
  );
}
