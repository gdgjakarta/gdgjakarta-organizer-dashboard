import { NotFoundContent } from "@/components/not-found-content";
import { APP_CONFIG } from "@/config/app-config";

export default function ExternalNotFound() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
      <title>{`404 - Page Not Found | ${APP_CONFIG.name}`}</title>
      <meta
        name="description"
        content="The page you are looking for doesn't exist, has been moved, or is temporarily unavailable."
      />
      <NotFoundContent />
    </div>
  );
}
