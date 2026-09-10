import { Globe } from "lucide-react";

import { APP_CONFIG } from "@/config/app-config";

import { GoogleButton } from "../_components/social-auth/google-button";

export default function LoginPage() {
  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-87.5">
        <div className="space-y-2 text-center">
          <h1 className="font-medium text-3xl">Sign in to GDG Jakarta</h1>
          <p className="text-muted-foreground text-sm">
            Sign in with your Google account to access your member dashboard, events, or organizer tools.
          </p>
        </div>
        <div className="space-y-4">
          <GoogleButton className="w-full" />
        </div>
      </div>

      <div className="absolute bottom-5 flex w-full justify-between px-10">
        <div className="text-sm">{APP_CONFIG.copyright}</div>
        <div className="flex items-center gap-1 text-sm">
          <Globe className="size-4 text-muted-foreground" />
          ENG
        </div>
      </div>
    </>
  );
}
