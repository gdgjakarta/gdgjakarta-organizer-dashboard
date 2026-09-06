export const BEVY_CONFIG = {
  baseUrl: process.env.BEVY_API_BASE_URL || "https://gdg.community.dev/api",
  chapterSlug: process.env.BEVY_CHAPTER_SLUG || "gdg-jakarta",
  chapterId: process.env.BEVY_CHAPTER_ID || "642",
  apiToken: process.env.BEVY_API_TOKEN,
  csrfToken: process.env.BEVY_CSRF_TOKEN || "6iP8zuVoLQCPMG5ge0yFc6ljZdL7zL6v",
  cookie:
    process.env.BEVY_COOKIE ||
    "csrftoken=UmVqaRjdKY6A8GZfyVC9wOAyC7LOFDSu;sessionid=hhx6kcyci4agi2ekiu5unm5ta873yzzh;csrftoken=6iP8zuVoLQCPMG5ge0yFc6ljZdL7zL6v;sessionid=ojunfzar221d84qchaf7dh2c6fjxau0d",
};
