# Event Certificate n8n Workflows

Import both JSON files into your n8n **`API`** folder (`https://n8n.gdgjakarta.com`) and activate them.

## 1. `generate-certificate-api.json` (`POST /webhook/api/generate-certificate`)
Supports both certificate engines:
- **`mode: "google_slides"` (Default)**: Copies the 1-slide 4:3 Google Slides template (`supportsAllDrives=true`, optional `tempFolderId`), executes a single atomic `batchUpdate` (`replaceAllText`) for all `replacements`, exports to PDF, and deletes the temporary copy on both success and error paths.
- **`mode: "export_drawing_pdf"` (Google Drawing Overlay)**: Exports a Google Drawing directly to PDF via Google Drive API so the dashboard can cache the background in Cloudflare R2 and stamp dynamic text/QR fields with `pdf-lib`.

### One-Time Setup
1. Import `generate-certificate-api.json` into n8n.
2. `GDG Jakarta API Auth` (`OhKNMRKIAMZomRhC`) and `Google Drive account` (`dQuvWh9mXirxb1zn`) are pre-wired.
3. Add a **`Google Slides OAuth2 API`** credential (using the same Google Cloud OAuth app as your Google Drive credential) and assign it to the **`Replace Slide Placeholders`** node.
4. Activate the workflow.

### Converting a Google Drawing to a 1-Slide Google Slides Template
1. Create a new Google Slides deck → **File → Page setup → Standard 4:3 (`10 × 7.5 inches`)** (matches the `720 × 540 pt` Google Drawing canvas 1:1).
2. In your Google Drawing, press `Cmd+A` → `Cmd+C`, then paste (`Cmd+V`) onto Slide 1.
3. Replace dynamic text with placeholders:
   - `{{recipient_name}}`
   - `{{event_name}}`
   - `{{event_date}}`
   - `{{role}}` (e.g., `Attendee`, `Speaker`, `Mentor`, `Moderator`)
   - `{{talk_title}}`
   - `{{certificate_code}}`
   - `{{issued_date}}`
   - `{{verify_url}}`

## 2. `send-certificate-email-api.json` (`POST /webhook/api/send-certificate-email`)
Downloads the certificate PDF from `https://assets.gdgjakarta.org/...`, normalizes the filename, and sends the email with a real file attachment (`options.fileAttachments: "attachment"`) using `SMTP Relay Account - info@gdgjakarta.org` (`vXvzJ712DNsZfnX8`). Leaves the existing `Send Email API` untouched.
