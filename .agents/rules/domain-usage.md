# Domain Usage Standard: gdgjakarta.com vs gdgjakarta.org

Follow these strict invariants for all URL generation, email templates, webhooks, and routing:

1. **`gdgjakarta.com` is the primary web application domain**:
   - All canonical web routes, event detail pages (`https://gdgjakarta.com/events/[id]`), speaker handbooks (`https://gdgjakarta.com/events/[id]/speaker-handbook`), speaker confirmation pages, and dashboard pages MUST point to `gdgjakarta.com`.
   - All transactional and marketing email link targets (action buttons, guidelines, resource links) MUST use `https://gdgjakarta.com`.
   - Subdomains/microservices use `.gdgjakarta.com` (e.g., `ops.gdgjakarta.com`, `n8n.gdgjakarta.com`, `gowa.gdgjakarta.com`).

2. **`gdgjakarta.org` is strictly reserved for shortlinks and email identities**:
   - Short.io shortlink redirects: ONLY short URLs generated through Short.io use `https://gdgjakarta.org/<slug>` (e.g., `gdgjakarta.org/devfest26`, `gdgjakarta.org/gdg-slide-template`).
   - Never build application deep-links using `gdgjakarta.org` (e.g., `gdgjakarta.org/events/...` is strictly invalid).
   - Email addresses (e.g. `info@gdgjakarta.org`) are valid sender/contact identities.
