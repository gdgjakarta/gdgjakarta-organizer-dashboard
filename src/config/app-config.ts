import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "GDG Jakarta",
  version: packageJson.version,
  copyright: `© ${currentYear}, GDG Jakarta.`,
  url: process.env.NEXT_PUBLIC_APP_URL || "https://gdgjakarta.org",
  meta: {
    title: "GDG Jakarta - Google Developer Groups",
    description:
      "GDG Jakarta is the official Google Developer Groups community in Jakarta, Indonesia. Connect, learn, and grow with developers, designers, and innovators through workshops, tech talks, and annual DevFests.",
    siteName: "GDG Jakarta",
    locale: "en_US",
    alternateLocale: "id_ID",
    twitterHandle: "@gdgjakarta",
    ogImage: "/og-image.png",
    ogImageAlt: "GDG Jakarta - Google Developer Groups Community",
    keywords: [
      "GDG Jakarta",
      "Google Developer Groups",
      "Google Developer Groups Jakarta",
      "Tech Community Jakarta",
      "Developer Community Indonesia",
      "Tech Events Jakarta",
      "Google Technologies",
      "Android",
      "Cloud",
      "AI",
      "Web Development",
      "Machine Learning",
      "Flutter",
      "DevFest Jakarta",
    ],
  },
};
