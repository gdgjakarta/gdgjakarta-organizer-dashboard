export interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  headline: string;
  message: string;
  estimatedEndTime?: string | null;
  allowOrganizerBypass: boolean;
  contactEmail: string;
  supportLink?: string;
  showSocialLinks: boolean;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
}

export const DEFAULT_MAINTENANCE_CONFIG: MaintenanceConfig = {
  enabled: false,
  title: "Under Scheduled Maintenance",
  headline: "We're making GDG Jakarta even better!",
  message:
    "Our team is currently performing scheduled system updates and improvements. All community services and event registration will resume shortly.",
  estimatedEndTime: null,
  allowOrganizerBypass: true,
  contactEmail: "info@gdgjakarta.org",
  supportLink: "https://instagram.com/gdgjakarta",
  showSocialLinks: true,
};
