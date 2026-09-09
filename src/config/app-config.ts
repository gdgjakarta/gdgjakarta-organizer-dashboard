import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "GDG Jakarta",
  version: packageJson.version,
  copyright: `© ${currentYear}, GDG Jakarta.`,
  meta: {
    title: "GDG Jakarta",
    description:
      "GDG Jakarta is a web application that provides a comprehensive platform for managing and monitoring various aspects of GDG Jakarta's activities, events, and community engagement.",
  },
};
