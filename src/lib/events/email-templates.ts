import { format } from "date-fns";

import { resolveEventAudience } from "@/lib/bevy/audience";
import { toTimezoneDate } from "@/lib/date-utils";
import type { EmailTemplateKey, FirestoreEvent } from "@/lib/firestore/types";
import { assertSafeWebhookUrl } from "@/lib/security/webhook-validator";

export type { EmailTemplateKey };

export const SAMPLE_QR_CODE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAMgAAADIAQMAAACXljzdAAAABlBMVEX///8AAABVwtN+AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAA/UlEQVRYheWYwRGEIAxFv+OBoyVQypbmlkYplODRgyMmP+C4O9hAyIWBlwsh+YkCr7YWs4xwAp8c6v70R5JdOC87UBLCwX3wSKLcWAhjIEfHJPttTHJHxz0B9CiPSVotqINUfadKnJCmb8s+lb7yuScPYx6gZy6IxYCLdrOyz5obKgHeiDww5gLELdSM11CUsUh9dOlmckCx+814RyTafalviDafMQ/GIcyDOqlqRzfCwnBGmi18fnFT7y2MRNaa+89u9qWrO5JsyW1Ku7+9/JFY6kyuMbBuRiUfkoAScJtrIvrG2h6O2GJ5IKaCn/7+RvggT31jDLrK55q82gUvTG0vlaj95wAAAABJRU5ErkJggg==";

export const DEFAULT_INTEREST_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Registration Received: {{ $(\'event-params\').item.json.eventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 0 0 30px 0; /* Padding only at bottom for full-width header */\n        border-radius: 8px;\n        overflow: hidden; /* Clips the image to the border radius */\n      }\n      \n      .content {\n        padding: 0 30px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        display: block; /* Removes bottom spacing */\n        border-radius: 8px 8px 0 0;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      .btn {\n        display: block;\n        background-color: #4285f4;\n        color: #fff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 20px;\n        text-decoration: none;\n        width: 70%;\n        margin: 25px auto;\n        font-weight: 600;\n        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);\n        transition: background-color 0.3s;\n      }\n\n      .btn:hover {\n        background-color: #3367d6;\n      }\n\n      .step-box {\n        background-color: #f8f9fa;\n        padding: 20px;\n        border-radius: 8px;\n        margin: 20px 0;\n        border: 1px solid #e0e0e0;\n      }\n\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 20px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      .note-box {\n        background-color: #fce8e6;\n        border-left: 4px solid #ea4335;\n        padding: 15px;\n        margin-top: 20px;\n        color: #c5221f;\n        font-size: 0.95em;\n      }\n\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n      \n      p {\n          line-height: 1.6;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <!-- Header Image -->\n        <img src="{{ $(\'event-params\').item.json.eventHeaderUrl }}" onerror="this.src=\'https://placehold.co/600x300?text=Road+To+DevFest\'" alt="{{ $(\'event-params\').item.json.eventName }} Header" class="header-img" />\n      </div>\n      \n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'loop-send-email\').item.json[\'Full Name\'] }},</h2>\n        </div>\n        \n        <div class="start">\n          <p style="font-size: 1.1em;"><strong>We\u2019ve received your registration interest!</strong> \u2601\ufe0f</p>\n          \n          <p>Thank you for registering for <strong>{{ $(\'event-params\').item.json.eventName }}</strong>. We are thrilled by the overwhelming interest in this event.</p>\n\n          <!-- Registration Checklist -->\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #4285f4;">\ud83d\udcdd Important Registration Notes</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n          \n          <!-- Process Explanation -->\n          <div class="step-box">\n              <h3 style="margin-top: 0; color: #4285f4;">What Happens Next?</h3>\n              \n              <p><strong>1. Participant Curation</strong><br>\n              Our team will review all registrations to ensure a diverse and professional group of attendees. We aim to create the best environment for meaningful industry connections.</p>\n              \n              <p><strong>2. Outcome Notification</strong><br>\n              <span style="display:block; margin-top:5px;">\u2705 <strong>If selected:</strong> You will receive a separate follow-up email containing your <strong>Official Confirmation</strong> and an exclusive invitation to join our <strong>Google Chat Space</strong> to connect with other attendees.</span>\n              <span style="display:block; margin-top:5px;">\u274c <strong>If not selected:</strong> You will receive a notification email informing you that we are unable to provide a seat for you at this specific event.</span>\n              </p>\n          </div>\n\n          <p style="text-align: center; margin-top: 10px;">Please keep an eye on your inbox for our final update!</p>\n          \n          <a href="{{ $(\'event-params\').item.json.eventActionUrl }}" class="btn" target="_blank">View Event Details</a>\n\n          <p style="margin-top: 30px; font-size: 0.9em; color: #555;">Thank you for your understanding and for being part of our community. We hope to see you soon!</p>\n        </div>\n      </div>\n\n      <div class="center" style="text-align: center;">\n        <div class="footer" style="margin-top: 24pt; padding: 18pt; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">\n          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" width="113" style="width: 113px; height: auto; display: inline-block; border: 0;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export const DEFAULT_ACCEPTED_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Your Official Ticket & Reminders: {{ $(\'bevy-config\').item.json.bevyEventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 30px;\n        border-radius: 8px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        border-radius: 8px 8px 0 0;\n        background-color: #4285f4;\n        min-height: 100px;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      /* Ticket Styles */\n      .ticket-card {\n        background-color: #f8f9fa;\n        border: 2px dashed #4285f4;\n        border-radius: 12px;\n        padding: 25px;\n        margin: 25px 0;\n        text-align: center;\n        position: relative;\n      }\n\n      .ticket-title {\n        color: #4285f4;\n        font-weight: 600;\n        margin-bottom: 5px;\n        text-transform: uppercase;\n        letter-spacing: 1px;\n        font-size: 0.9em;\n      }\n\n      .qr-placeholder {\n        background-color: #ffffff;\n        padding: 10px;\n        border-radius: 8px;\n        display: inline-block;\n        margin: 15px 0;\n        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);\n      }\n\n      .qr-img {\n        width: 200px;\n        height: 200px;\n        display: block;\n      }\n\n      .attendee-name {\n        font-size: 1.3em;\n        font-weight: 600;\n        color: #202124;\n        margin: 5px 0;\n      }\n\n      .attendee-id {\n        display: inline-block;\n        background-color: #e8f0fe;\n        color: #1967d2;\n        padding: 6px 14px;\n        border-radius: 4px;\n        font-family: \'Courier New\', monospace;\n        font-size: 14px;\n        font-weight: 600;\n        margin-bottom: 25px;\n        line-height: 1.35;\n      }\n\n      .details-box {\n        background-color: #ffffff;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 15px;\n        margin-top: 20px;\n        text-align: left;\n      }\n\n      .detail-row {\n        display: flex;\n        margin-bottom: 10px;\n      }\n\n      .detail-row:last-child {\n        margin-bottom: 0;\n      }\n\n      .detail-icon {\n        margin-right: 10px;\n        font-size: 1.1em;\n      }\n\n      /* Reminder Checklist Styles */\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 25px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      /* Button Styles */\n      .btn {\n        display: block;\n        background-color: #4285f4;\n        color: #ffffff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 24px;\n        text-decoration: none;\n        width: 70%;\n        margin: 20px auto;\n        font-weight: 600;\n        font-size: 15px;\n        box-shadow: 0 4px 6px rgba(0,0,0,0.1);\n      }\n      \n      .btn:hover {\n        background-color: #3367d6;\n      }\n\n      /* Global Content Elements */\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n\n      .content {\n        padding: 0 15px;\n      }\n\n      p {\n        line-height: 1.6;\n      }\n\n      strong {\n        color: #202124;\n      }\n\n      a.location-link {\n        color: #1a73e8;\n        text-decoration: none;\n        font-weight: 600;\n      }\n\n      a.location-link:hover {\n        text-decoration: underline;\n      }\n\n      code {\n        background-color: #f1f3f4;\n        padding: 2px 6px;\n        border-radius: 4px;\n        font-family: \'Courier New\', Courier, monospace;\n        font-size: 0.9em;\n        color: #c5221f;\n        font-weight: 600;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <img src="{{ $(\'bevy-config\').item.json.bevyEventHeaderEmailUrl }}" onerror="this.src=\'https://placehold.co/600x300?text=Event+Header\'" alt="Event Header" class="header-img" />\n      </div>\n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'bevy-config\').item.json.bevyUserName }},</h2>\n        </div>\n        <div class="start">\n          <p>Your ticket is confirmed! \ud83c\udf9f\ufe0f</p>\n          <p>We are thrilled to welcome you to <strong>{{ $(\'bevy-config\').item.json.bevyEventName }}</strong>. Below is your official entrance ticket and important guidelines to ensure a smooth experience.</p>\n          \n          <div class="ticket-card">\n            <div class="ticket-title">Official Entry Pass</div>\n            <div class="qr-placeholder">\n              <img src="data:image/png;base64,{{ $(\'Generate QR Code\').item.json.qrCode }}" alt="Your Ticket QR Code" class="qr-img" />\n            </div>\n            <div class="attendee-name">{{ $(\'bevy-config\').item.json.bevyUserName }}</div>\n            <div class="attendee-id">\n              <div>Ref: {{ $(\'Add Bevy Attendee API\').item.json.attendee_code }}</div>\n              <div style="margin-top: 2px;">ID: {{ $(\'Add Bevy Attendee API\').item.json.id }}</div>\n            </div>\n            \n            <div class="details-box">\n              <div class="detail-row">\n                <span class="detail-icon">\ud83d\udcc5</span>\n                <div>\n                  <strong>Date</strong>\n                  <br>\n                  {{ $(\'bevy-config\').item.json.bevyEventDate }}\n                </div>\n              </div>\n              <div class="detail-row">\n                <span class="detail-icon">\u23f0</span>\n                <div>\n                  <strong>Time</strong>\n                  <br>\n                  {{ $(\'session-config\').item.json.bevySessionTime }}\n                </div>\n              </div>\n              <div class="detail-row">\n                <span class="detail-icon">\u23f3</span>\n                <div>\n                  <strong>Check-in Deadline</strong>\n                  <br>\n                  {{ $(\'session-config\').item.json.bevyCheckinDeadline }}\n                </div>\n              </div>\n              <div class="detail-row">\n                <span class="detail-icon">\ud83d\udccd</span>\n                <div>\n                  <strong>Location</strong>\n                  <br>\n                  <a href="{{ $(\'bevy-config\').item.json.bevyEventLocationUrl }}" class="location-link" target="_blank">\n                    {{ $(\'bevy-config\').item.json.bevyEventLocation }}\n                  </a>\n                </div>\n              </div>\n            </div>\n          </div>\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #4285f4;">\ud83d\udcdd Attendee Checklist</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n          <div style="text-align: center; margin: 25px 0 10px 0;">\n            <div class="btn" style="display: inline-block; background-color: #4285f4; color: #ffffff !important; text-align: center; border-radius: 50px; padding: 12px 36px; font-weight: 600; font-size: 15px; text-decoration: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">\n              See you at the venue! \ud83d\ude80\n            </div>\n          </div>\n        </div>\n      </div>\n      <div class="center">\n        <div class="footer">\n          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export const DEFAULT_REJECTED_HYBRID_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Update regarding: {{ $(\'email-config\').item.json.eventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 30px;\n        border-radius: 8px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        border-radius: 8px 8px 0 0;\n        background-color: #4285f4;\n        min-height: 100px;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      .btn {\n        display: block;\n        background-color: #4285f4;\n        color: #ffffff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 24px;\n        text-decoration: none;\n        width: 60%;\n        margin: 30px auto;\n        font-weight: 600;\n        font-size: 15px;\n        box-shadow: 0 4px 6px rgba(0,0,0,0.1);\n      }\n      \n      .btn:hover {\n        background-color: #3367d6;\n      }\n\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 20px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n\n      .content {\n        padding: 0 15px;\n      }\n\n      /* Fixed Info Box with Symmetrical Spacing adjusted to 16px */\n      .info-box {\n        background-color: #fce8e6;\n        border: 1px solid #ea4335;\n        border-radius: 8px;\n        padding: 16px; \n        margin: 24px 0;\n        color: #b31412;\n      }\n\n      .info-box p {\n        margin-top: 0; \n        margin-bottom: 16px; \n        line-height: 1.6;\n      }\n\n      .info-box p:last-child {\n        margin-bottom: 0; \n      }\n\n      p {\n        line-height: 1.6;\n        margin-bottom: 15px;\n      }\n\n      strong {\n        color: #202124;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <!-- Header Image -->\n        <img src="{{ $(\'email-config\').item.json.eventHeaderEmailUrl }}" onerror="this.src=\'https://placehold.co/600x300?text={{ $(\'email-config\').item.json.eventName }}\'" alt="Event Header" class="header-img" />\n      </div>\n      \n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'loop-send-rejected-email\').item.json[\'Full Name\'] }},</h2>\n        </div>\n        \n        <div class="start">\n          <p>Thank you for your interest in attending <strong>{{ $(\'email-config\').item.json.eventName }}</strong>.</p>\n          \n          <div class="info-box">\n            <p>\n              Due to overwhelming interest and strictly limited venue capacity, we are unfortunately unable to offer you a spot for this particular session.\n            </p>\n            <p>\n              Our selection process prioritizes applicants whose background, interests, and goals are most closely aligned with the focus and discussions planned for the event.\n            </p>\n          </div>\n\n          <!-- Alternatives Checklist -->\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #4285f4;">\ud83d\udccc Next Steps & Alternatives</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n\n          <p>We sincerely appreciate your interest in our event and hope to welcome you at future events and community initiatives.</p>\n          \n          <p>We encourage you to keep your professional profiles updated and stay connected for future technical workshops and community meetups.</p>\n\n          <a href="{{ $(\'email-config\').item.json.actionButtonUrl }}" class="btn">Follow Our Updates</a>\n\n          <p style="margin-top: 30px; font-size: 0.9em; color: #5f6368;">\n            Thank you for your understanding, and we hope to see you at another event soon!\n          </p>\n        </div>\n      </div>\n      \n      <div class="center">\n        <div class="footer">\n          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export const DEFAULT_REJECTED_NON_HYBRID_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Update regarding: {{ $(\'email-config\').item.json.eventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 30px;\n        border-radius: 8px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        border-radius: 8px 8px 0 0;\n        background-color: #4285f4;\n        min-height: 100px;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      .btn {\n        display: block;\n        background-color: #4285f4;\n        color: #ffffff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 24px;\n        text-decoration: none;\n        width: 60%;\n        margin: 30px auto;\n        font-weight: 600;\n        font-size: 15px;\n        box-shadow: 0 4px 6px rgba(0,0,0,0.1);\n      }\n      \n      .btn:hover {\n        background-color: #3367d6;\n      }\n\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 20px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n\n      .content {\n        padding: 0 15px;\n      }\n\n      /* Fixed Info Box with Symmetrical Spacing adjusted to 16px */\n      .info-box {\n        background-color: #fce8e6;\n        border: 1px solid #ea4335;\n        border-radius: 8px;\n        padding: 16px; \n        margin: 24px 0;\n        color: #b31412;\n      }\n\n      .info-box p {\n        margin-top: 0; \n        margin-bottom: 16px; \n        line-height: 1.6;\n      }\n\n      .info-box p:last-child {\n        margin-bottom: 0; \n      }\n\n      p {\n        line-height: 1.6;\n        margin-bottom: 15px;\n      }\n\n      strong {\n        color: #202124;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <!-- Header Image -->\n        <img src="{{ $(\'email-config\').item.json.eventHeaderEmailUrl }}" onerror="this.src=\'https://placehold.co/600x300?text=IWD+Jakarta+2026\'" alt="Event Header" class="header-img" />\n      </div>\n      \n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'loop-send-rejected-email\').item.json[\'Full Name\'] }},</h2>\n        </div>\n        \n        <div class="start">\n          <p>Thank you for your interest in attending <strong>{{ $(\'email-config\').item.json.eventName }}</strong>.</p>\n          \n          <div class="info-box">\n            <p>\n              Due to overwhelming interest and strictly limited venue capacity, we are unfortunately unable to offer you a spot for this particular session.\n            </p>\n            <p>\n              Our selection process prioritizes applicants whose background, interests, and goals are most closely aligned with the focus and discussions planned for the event.\n            </p>\n          </div>\n\n          <!-- Important Notes Checklist -->\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #4285f4;">\ud83d\udccc Important Community Notes</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n\n          <p>We sincerely appreciate your interest in our event and hope to welcome you at future events and community initiatives.</p>\n          \n          <p>We encourage you to keep your professional profiles updated and stay connected for future technical workshops and community meetups.</p>\n\n          <a href="{{ $(\'email-config\').item.json.actionButtonUrl }}" class="btn">Follow Our Updates</a>\n\n          <p style="margin-top: 30px; font-size: 0.9em; color: #5f6368;">\n            Thank you for your understanding, and we hope to see you at another event soon!\n          </p>\n        </div>\n      </div>\n      \n      <div class="center">\n        <div class="footer">\n          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export const DEFAULT_REJECTED_VIRTUAL_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Update regarding: {{ $(\'email-config\').item.json.eventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 30px;\n        border-radius: 8px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        border-radius: 8px 8px 0 0;\n        background-color: #4285f4;\n        min-height: 100px;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      .btn {\n        display: block;\n        background-color: #4285f4;\n        color: #ffffff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 24px;\n        text-decoration: none;\n        width: 60%;\n        margin: 30px auto;\n        font-weight: 600;\n        font-size: 15px;\n        box-shadow: 0 4px 6px rgba(0,0,0,0.1);\n      }\n      \n      .btn:hover {\n        background-color: #3367d6;\n      }\n\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 20px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n\n      .content {\n        padding: 0 15px;\n      }\n\n      /* Fixed Info Box with Symmetrical Spacing adjusted to 16px */\n      .info-box {\n        background-color: #fce8e6;\n        border: 1px solid #ea4335;\n        border-radius: 8px;\n        padding: 16px; \n        margin: 24px 0;\n        color: #b31412;\n      }\n\n      .info-box p {\n        margin-top: 0; \n        margin-bottom: 16px; \n        line-height: 1.6;\n      }\n\n      .info-box p:last-child {\n        margin-bottom: 0; \n      }\n\n      p {\n        line-height: 1.6;\n        margin-bottom: 15px;\n      }\n\n      strong {\n        color: #202124;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <!-- Header Image -->\n        <img src="{{ $(\'email-config\').item.json.eventHeaderEmailUrl }}" onerror="this.src=\'https://placehold.co/600x300?text={{ $(\'email-config\').item.json.eventName }}\'" alt="Event Header" class="header-img" />\n      </div>\n      \n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'loop-send-rejected-email\').item.json[\'Full Name\'] }},</h2>\n        </div>\n        \n        <div class="start">\n          <p>Thank you for your interest in attending <strong>{{ $(\'email-config\').item.json.eventName }}</strong>.</p>\n          \n          <div class="info-box">\n            <p>\n              Due to high registration interest and virtual workshop capacity limits, we are unfortunately unable to offer you an active participant spot for this virtual event.\n            </p>\n            <p>\n              Our selection process prioritizes applicants whose background, interests, and goals are most closely aligned with the interactive session topics and hands-on exercises.\n            </p>\n          </div>\n\n          <!-- Alternatives Checklist -->\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #4285f4;">\ud83d\udccc Next Steps &amp; Online Resources</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n\n          <p>We sincerely appreciate your interest and hope to welcome you at upcoming webinars, technical workshops, and virtual community initiatives.</p>\n          \n          <p>We encourage you to stay connected with the community and keep an eye on our event schedule for upcoming technical deep dives.</p>\n\n          <a href="{{ $(\'email-config\').item.json.actionButtonUrl }}" class="btn">Explore Community Events</a>\n\n          <p style="margin-top: 30px; font-size: 0.9em; color: #5f6368;">\n            Thank you for your understanding, and we look forward to seeing you at a future session!\n          </p>\n        </div>\n      </div>\n      \n      <div class="center">\n        <div class="footer">\n          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export const DEFAULT_CANCELLED_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Registration Cancelled: {{ $(\'event-params\').item.json.eventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 30px;\n        border-radius: 8px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        border-radius: 8px 8px 0 0;\n        background-color: #ea4335;\n        min-height: 100px;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      .btn {\n        display: block;\n        background-color: #ea4335;\n        color: #ffffff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 24px;\n        text-decoration: none;\n        width: 70%;\n        margin: 30px auto;\n        font-weight: 600;\n        font-size: 15px;\n        box-shadow: 0 4px 6px rgba(0,0,0,0.1);\n      }\n      \n      .btn:hover {\n        background-color: #d93025;\n      }\n\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 20px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n\n      .content {\n        padding: 0 15px;\n      }\n\n      .alert-box {\n        background-color: #fce8e6;\n        border: 1px solid #ea4335;\n        border-radius: 8px;\n        padding: 16px;\n        margin: 24px 0;\n        color: #b31412;\n      }\n\n      .alert-box p {\n        margin-top: 0;\n        margin-bottom: 12px;\n        line-height: 1.6;\n      }\n\n      .alert-box p:last-child {\n        margin-bottom: 0;\n      }\n\n      p {\n        line-height: 1.6;\n        margin-bottom: 15px;\n      }\n\n      strong {\n        color: #202124;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <!-- Header Image -->\n        <img src="{{ $(\'event-params\').item.json.eventHeaderUrl }}" onerror="this.src=\'https://placehold.co/600x300?text=Registration+Cancelled\'" alt="Event Header" class="header-img" />\n      </div>\n      \n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'loop-send-email\').item.json[\'Full Name\'] }},</h2>\n        </div>\n        \n        <div class="start">\n          <p>We are writing to notify you regarding your registration for <strong>{{ $(\'event-params\').item.json.eventName }}</strong>.</p>\n          \n          <div class="alert-box">\n            <p><strong>Notice of Registration Cancellation:</strong></p>\n            <p>Your registration has been cancelled by the organizer and you have been removed from the event. If you change your mind, you need to re-register again.</p>\n            <p><strong>Reason for Cancellation:</strong><br>{{ $(\'event-params\').item.json.cancellationReason }}</p>\n          </div>\n\n          <!-- Cancellation Checklist / Notes -->\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #ea4335;">📋 Important Information</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n\n          <p>If you have any questions or believe this was done in error, please feel free to reach out to our organizing team.</p>\n          \n          <a href="{{ $(\'event-params\').item.json.eventActionUrl }}" class="btn">View Event &amp; Re-Register</a>\n\n          <p style="margin-top: 30px; font-size: 0.9em; color: #5f6368; text-align: center;">\n            Thank you for your understanding.\n          </p>\n        </div>\n      </div>\n      \n      <div class="center">\n        <div class="footer">\n          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export const DEFAULT_CANCELLED_ATTENDEE_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Registration Cancelled: {{ $(\'event-params\').item.json.eventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 30px;\n        border-radius: 8px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        border-radius: 8px 8px 0 0;\n        background-color: #ea4335;\n        min-height: 100px;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      .btn {\n        display: block;\n        background-color: #ea4335;\n        color: #ffffff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 24px;\n        text-decoration: none;\n        width: 70%;\n        margin: 30px auto;\n        font-weight: 600;\n        font-size: 15px;\n        box-shadow: 0 4px 6px rgba(0,0,0,0.1);\n      }\n      \n      .btn:hover {\n        background-color: #d93025;\n      }\n\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 20px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n\n      .content {\n        padding: 0 15px;\n      }\n\n      .alert-box {\n        background-color: #fce8e6;\n        border: 1px solid #ea4335;\n        border-radius: 8px;\n        padding: 16px;\n        margin: 24px 0;\n        color: #b31412;\n      }\n\n      .alert-box p {\n        margin-top: 0;\n        margin-bottom: 12px;\n        line-height: 1.6;\n      }\n\n      .alert-box p:last-child {\n        margin-bottom: 0;\n      }\n\n      p {\n        line-height: 1.6;\n        margin-bottom: 15px;\n      }\n\n      strong {\n        color: #202124;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <!-- Header Image -->\n        <img src="{{ $(\'event-params\').item.json.eventHeaderUrl }}" onerror="this.src=\'https://placehold.co/600x300?text=Registration+Cancelled\'" alt="Event Header" class="header-img" />\n      </div>\n      \n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'loop-send-email\').item.json[\'Full Name\'] }},</h2>\n        </div>\n        \n        <div class="start">\n          <p>We are writing to confirm that your registration for <strong>{{ $(\'event-params\').item.json.eventName }}</strong> has been cancelled.</p>\n          \n          <div class="alert-box">\n            <p><strong>Notice of Registration Cancellation:</strong></p>\n            <p>Your registration has been canceled and your registration will be removed from the event. If you change your mind, you need to re-register again.</p>\n          </div>\n\n          <!-- Cancellation Checklist / Notes -->\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #ea4335;">\ud83d\udccb Important Information</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n\n          <p>If you have any questions or cancelled this by mistake, you can return to the event page anytime while registration remains open.</p>\n          \n          <a href="{{ $(\'event-params\').item.json.eventActionUrl }}" class="btn">View Event &amp; Re-Register</a>\n\n          <p style="margin-top: 30px; font-size: 0.9em; color: #5f6368; text-align: center;">\n            Thank you for being part of the GDG Jakarta community.\n          </p>\n        </div>\n      </div>\n      \n      <div class="center" style="text-align: center;">\n        <div class="footer" style="margin-top: 24pt; padding: 18pt; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">\n          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" width="113" style="width: 113px; height: auto; display: inline-block; border: 0;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export const DEFAULT_WAITLISTED_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Waitlist Update: {{ $(\'event-params\').item.json.eventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 30px;\n        border-radius: 8px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        border-radius: 8px 8px 0 0;\n        background-color: #f9ab00;\n        min-height: 100px;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      .btn {\n        display: block;\n        background-color: #1a73e8;\n        color: #ffffff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 24px;\n        text-decoration: none;\n        width: 70%;\n        margin: 30px auto;\n        font-weight: 600;\n        font-size: 15px;\n        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);\n      }\n      \n      .btn:hover {\n        background-color: #1557b0;\n      }\n\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 20px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n\n      .content {\n        padding: 0 15px;\n      }\n\n      .waitlist-box {\n        background-color: #fef7e0;\n        border: 1px solid #f9ab00;\n        border-radius: 8px;\n        padding: 16px;\n        margin: 24px 0;\n        color: #7a4100;\n      }\n\n      .waitlist-box p {\n        margin-top: 0;\n        margin-bottom: 12px;\n        line-height: 1.6;\n      }\n\n      .waitlist-box p:last-child {\n        margin-bottom: 0;\n      }\n\n      .step-box {\n        background-color: #f8f9fa;\n        padding: 20px;\n        border-radius: 8px;\n        margin: 20px 0;\n        border: 1px solid #e0e0e0;\n      }\n\n      p {\n        line-height: 1.6;\n        margin-bottom: 15px;\n      }\n\n      strong {\n        color: #202124;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <!-- Header Image -->\n        <img src="{{ $(\'event-params\').item.json.eventHeaderUrl }}" onerror="this.src=\'https://placehold.co/600x300?text=Waitlist+Notification\'" alt="Event Header" class="header-img" />\n      </div>\n      \n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'loop-send-email\').item.json[\'Full Name\'] }},</h2>\n        </div>\n        \n        <div class="start">\n          <p>Thank you for registering for <strong>{{ $(\'event-params\').item.json.eventName }}</strong>.</p>\n          \n          <div class="waitlist-box">\n            <p><strong>Notice of Waitlist Placement:</strong></p>\n            <p>Your registration has been placed on the official event waitlist. Because our venue capacity has currently been reached, we are unable to assign a confirmed seat for you at this time.</p>\n          </div>\n\n          <!-- Process Explanation -->\n          <div class="step-box">\n            <h3 style="margin-top: 0; color: #f29900;">How the Waitlist Works</h3>\n            <p><strong>1. Automatic Seat Reallocation</strong><br>If a confirmed attendee cancels their ticket or venue capacity expands, spots are automatically allocated to waitlisted applicants in order.</p>\n            <p><strong>2. Ticket Confirmation Update</strong><br>If a seat becomes available for you, you will receive an official confirmation email containing your entrance pass and QR code.</p>\n          </div>\n\n          <!-- Waitlist Guidelines Checklist -->\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #f29900;">📋 Important Waitlist Notes</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n\n          <p>We truly appreciate your interest in our event and thank you for your patience and understanding.</p>\n          \n          <a href="{{ $(\'event-params\').item.json.eventActionUrl }}" class="btn">View Event Details</a>\n\n          <p style="margin-top: 30px; font-size: 0.9em; color: #5f6368; text-align: center;">\n            Thank you for being part of the GDG Jakarta community.\n          </p>\n        </div>\n      </div>\n      \n      <div class="center" style="text-align: center;">\n        <div class="footer" style="margin-top: 24pt; padding: 18pt; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">\n          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" width="113" style="width: 113px; height: auto; display: inline-block; border: 0;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export const DEFAULT_PAID_WAITLISTED_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Payment Received - Priority Waitlist: {{ $(\'event-params\').item.json.eventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 30px;\n        border-radius: 8px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        border-radius: 8px 8px 0 0;\n        background-color: #1a73e8;\n        min-height: 100px;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      .btn {\n        display: block;\n        background-color: #1a73e8;\n        color: #ffffff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 24px;\n        text-decoration: none;\n        width: 70%;\n        margin: 30px auto;\n        font-weight: 600;\n        font-size: 15px;\n        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);\n      }\n      \n      .btn:hover {\n        background-color: #1557b0;\n      }\n\n      .receipt-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e8eaed;\n        border-radius: 8px;\n        padding: 16px 20px;\n        margin: 20px 0;\n      }\n\n      .receipt-row {\n        display: flex;\n        justify-content: space-between;\n        padding: 6px 0;\n        font-size: 0.9em;\n        border-bottom: 1px dashed #e8eaed;\n      }\n\n      .receipt-row:last-child {\n        border-bottom: none;\n        padding-top: 10px;\n        font-weight: 600;\n      }\n\n      .badge-paid {\n        display: inline-block;\n        background-color: #e6f4ea;\n        color: #137333;\n        font-size: 11px;\n        font-weight: 600;\n        padding: 3px 8px;\n        border-radius: 4px;\n      }\n\n      .waitlist-alert {\n        background-color: #fef7e0;\n        border: 1px solid #f9ab00;\n        border-radius: 8px;\n        padding: 16px;\n        margin: 20px 0;\n        color: #7a4100;\n      }\n\n      .waitlist-alert p {\n        margin-top: 0;\n        margin-bottom: 10px;\n        line-height: 1.6;\n      }\n\n      .waitlist-alert p:last-child {\n        margin-bottom: 0;\n      }\n\n      .step-box {\n        background-color: #f8f9fa;\n        padding: 20px;\n        border-radius: 8px;\n        margin: 20px 0;\n        border: 1px solid #e0e0e0;\n      }\n\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 20px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n\n      .content {\n        padding: 0 15px;\n      }\n\n      p {\n        line-height: 1.6;\n        margin-bottom: 15px;\n      }\n\n      strong {\n        color: #202124;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <!-- Header Image -->\n        <img src="{{ $(\'event-params\').item.json.eventHeaderUrl }}" onerror="this.src=\'https://placehold.co/600x300?text=Payment+Received+-+Waitlist\'" alt="Event Header" class="header-img" />\n      </div>\n      \n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'loop-send-email\').item.json[\'Full Name\'] }},</h2>\n        </div>\n        \n        <div class="start">\n          <p>We have successfully received your payment for <strong>{{ $(\'event-params\').item.json.eventName }}</strong>.</p>\n          \n          <!-- Payment Receipt Summary -->\n          <div class="receipt-box">\n            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">\n              <span style="font-size: 11px; text-transform: uppercase; color: #5f6368; font-weight: 600; letter-spacing: 0.5px;">Payment Receipt</span>\n              <span class="badge-paid">✓ PAID</span>\n            </div>\n            <div class="receipt-row">\n              <span style="color: #5f6368;">Invoice Number</span>\n              <span><strong>{{ invoice_number }}</strong></span>\n            </div>\n            <div class="receipt-row">\n              <span style="color: #5f6368;">Session / Ticket</span>\n              <span>{{ session_name }}</span>\n            </div>\n            <div class="receipt-row">\n              <span style="color: #5f6368;">Amount Paid</span>\n              <span style="color: #188038; font-size: 1.05em;">{{ paid_amount }}</span>\n            </div>\n          </div>\n\n          <!-- Capacity Notice -->\n          <div class="waitlist-alert">\n            <p><strong>Session Capacity Reached • Priority Waitlist Notice:</strong></p>\n            <p>While your payment was processed successfully, the selected session reached its maximum capacity. You have been placed on the <strong>Paid Priority Waitlist</strong>.</p>\n          </div>\n\n          <!-- What Happens Next -->\n          <div class="step-box">\n            <h3 style="margin-top: 0; color: #1a73e8;">What Happens Next?</h3>\n            <p><strong>1. Highest Priority Reallocation</strong><br>Paid waitlisted participants hold top priority over unpaid registrants. As soon as a confirmed attendee drops out or capacity expands, your seat is immediately reserved.</p>\n            <p><strong>2. Automatic Ticket &amp; QR Delivery</strong><br>Once allocated, you will automatically receive your official Bevy entrance pass and QR code via email with no extra payment required.</p>\n            <p><strong>3. Session Transfer or Full Refund Guarantee</strong><br>If a seat does not open up before the event, our team will offer you the option to switch to an available session track or receive a prompt 100% refund of your payment.</p>\n          </div>\n\n          <!-- Waitlist Guidelines Checklist -->\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #1a73e8;">📋 Attendee Guidelines</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n\n          <p>If you have any questions or would like to request an immediate refund or session change, please reply directly to this email.</p>\n          \n          <a href="{{ $(\'event-params\').item.json.eventActionUrl }}" class="btn">View Event Details</a>\n\n          <p style="margin-top: 30px; font-size: 0.9em; color: #5f6368; text-align: center;">\n            Thank you for your enthusiastic support of GDG Jakarta.\n          </p>\n        </div>\n      </div>\n      \n      <div class="center" style="text-align: center;">\n        <div class="footer" style="margin-top: 24pt; padding: 18pt; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">\n          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" width="113" style="width: 113px; height: auto; display: inline-block; border: 0;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export const DEFAULT_REJECTED_WAITLISTED_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Waitlist Update: {{ $(\'event-params\').item.json.eventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 30px;\n        border-radius: 8px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        border-radius: 8px 8px 0 0;\n        background-color: #ea4335;\n        min-height: 100px;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      .btn {\n        display: block;\n        background-color: #4285f4;\n        color: #ffffff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 24px;\n        text-decoration: none;\n        width: 65%;\n        margin: 30px auto;\n        font-weight: 600;\n        font-size: 15px;\n        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);\n      }\n      \n      .btn:hover {\n        background-color: #3367d6;\n      }\n\n      .info-box {\n        background-color: #fce8e6;\n        border: 1px solid #ea4335;\n        border-radius: 8px;\n        padding: 16px;\n        margin: 24px 0;\n        color: #b31412;\n      }\n\n      .info-box p {\n        margin-top: 0;\n        margin-bottom: 12px;\n        line-height: 1.6;\n      }\n\n      .info-box p:last-child {\n        margin-bottom: 0;\n      }\n\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 20px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n\n      .content {\n        padding: 0 15px;\n      }\n\n      p {\n        line-height: 1.6;\n        margin-bottom: 15px;\n      }\n\n      strong {\n        color: #202124;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <img src="{{ $(\'event-params\').item.json.eventHeaderUrl }}" onerror="this.src=\'https://placehold.co/600x300?text=Waitlist+Update\'" alt="Event Header" class="header-img" />\n      </div>\n      \n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'loop-send-email\').item.json[\'Full Name\'] }},</h2>\n        </div>\n        \n        <div class="start">\n          <p>Thank you for your interest and patience while on the waitlist for <strong>{{ $(\'event-params\').item.json.eventName }}</strong>.</p>\n          \n          <div class="info-box">\n            <p><strong>Waitlist Capacity Update:</strong></p>\n            <p>As all confirmed seats have been filled and no additional spots became available before registration closed, we are unfortunately unable to move your registration off the waitlist for this event.</p>\n          </div>\n\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #4285f4;">📌 Next Steps &amp; Community Updates</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n\n          <p>We truly appreciate your enthusiasm for our community and hope to welcome you at our upcoming workshops and events!</p>\n          \n          <a href="{{ $(\'event-params\').item.json.eventActionUrl }}" class="btn">Explore Upcoming Events</a>\n\n          <p style="margin-top: 30px; font-size: 0.9em; color: #5f6368; text-align: center;">\n            Thank you for being part of the GDG Jakarta community.\n          </p>\n        </div>\n      </div>\n      \n      <div class="center" style="text-align: center;">\n        <div class="footer" style="margin-top: 24pt; padding: 18pt; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">\n          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" width="113" style="width: 113px; height: auto; display: inline-block; border: 0;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export const DEFAULT_REJECTED_PAID_WAITLISTED_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Waitlist Update &amp; Refund Instructions: {{ $(\'event-params\').item.json.eventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 30px;\n        border-radius: 8px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        border-radius: 8px 8px 0 0;\n        background-color: #ea4335;\n        min-height: 100px;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      .btn {\n        display: block;\n        background-color: #1a73e8;\n        color: #ffffff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 24px;\n        text-decoration: none;\n        width: 70%;\n        margin: 30px auto;\n        font-weight: 600;\n        font-size: 15px;\n        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);\n      }\n      \n      .btn:hover {\n        background-color: #1557b0;\n      }\n\n      .receipt-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e8eaed;\n        border-radius: 8px;\n        padding: 16px 20px;\n        margin: 20px 0;\n      }\n\n      .receipt-row {\n        display: flex;\n        justify-content: space-between;\n        padding: 6px 0;\n        font-size: 0.9em;\n        border-bottom: 1px dashed #e8eaed;\n      }\n\n      .receipt-row:last-child {\n        border-bottom: none;\n        padding-top: 10px;\n        font-weight: 600;\n      }\n\n      .badge-refund {\n        display: inline-block;\n        background-color: #fef7e0;\n        color: #b06000;\n        font-size: 11px;\n        font-weight: 600;\n        padding: 3px 8px;\n        border-radius: 4px;\n      }\n\n      .info-box {\n        background-color: #fce8e6;\n        border: 1px solid #ea4335;\n        border-radius: 8px;\n        padding: 16px;\n        margin: 20px 0;\n        color: #b31412;\n      }\n\n      .info-box p {\n        margin-top: 0;\n        margin-bottom: 10px;\n        line-height: 1.6;\n      }\n\n      .info-box p:last-child {\n        margin-bottom: 0;\n      }\n\n      .step-box {\n        background-color: #f8f9fa;\n        padding: 20px;\n        border-radius: 8px;\n        margin: 20px 0;\n        border: 1px solid #e0e0e0;\n      }\n\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 20px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n\n      .content {\n        padding: 0 15px;\n      }\n\n      p {\n        line-height: 1.6;\n        margin-bottom: 15px;\n      }\n\n      strong {\n        color: #202124;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <img src="{{ $(\'event-params\').item.json.eventHeaderUrl }}" onerror="this.src=\'https://placehold.co/600x300?text=Waitlist+Update+%26+Refund\'" alt="Event Header" class="header-img" />\n      </div>\n      \n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'loop-send-email\').item.json[\'Full Name\'] }},</h2>\n        </div>\n        \n        <div class="start">\n          <p>Thank you for your patience on the Paid Priority Waitlist for <strong>{{ $(\'event-params\').item.json.eventName }}</strong>.</p>\n          \n          <div class="info-box">\n            <p><strong>Session Capacity Full • Refund Eligible:</strong></p>\n            <p>Unfortunately, all confirmed seats remained full and we are unable to allocate a seat for your registration. You are eligible for a <strong>full 100% refund</strong> of your ticket payment.</p>\n          </div>\n\n          <!-- Payment Receipt Summary -->\n          <div class="receipt-box">\n            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">\n              <span style="font-size: 11px; text-transform: uppercase; color: #5f6368; font-weight: 600; letter-spacing: 0.5px;">Payment Summary</span>\n              <span class="badge-refund">100% REFUND ELIGIBLE</span>\n            </div>\n            <div class="receipt-row">\n              <span style="color: #5f6368;">Invoice Number</span>\n              <span><strong>{{ invoice_number }}</strong></span>\n            </div>\n            <div class="receipt-row">\n              <span style="color: #5f6368;">Session / Ticket</span>\n              <span>{{ session_name }}</span>\n            </div>\n            <div class="receipt-row">\n              <span style="color: #5f6368;">Amount Paid</span>\n              <span style="color: #188038; font-size: 1.05em;">{{ paid_amount }}</span>\n            </div>\n          </div>\n\n          <!-- How to Request Refund -->\n          <div class="step-box">\n            <h3 style="margin-top: 0; color: #1a73e8;">How to Submit Your Refund Request</h3>\n            <p><strong>1. Open Your Member Dashboard</strong><br>Sign in to the GDG Jakarta Dashboard and navigate to <strong>My Events</strong>.</p>\n            <p><strong>2. Click &quot;Request Refund&quot;</strong><br>Select this event and click the <strong>Request Refund</strong> button. Your account is exempt from the standard refund cutoff deadline.</p>\n            <p><strong>3. Enter Payout Details</strong><br>Provide your preferred bank account or e-wallet details so our finance team can transfer your full refund promptly.</p>\n          </div>\n\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #1a73e8;">📋 Refund Guidelines</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n\n          <a href="{{ $(\'event-params\').item.json.eventActionUrl }}" class="btn">Submit Refund Request</a>\n\n          <p style="margin-top: 30px; font-size: 0.9em; color: #5f6368; text-align: center;">\n            We sincerely apologize for not being able to accommodate you this time and hope to see you at our next event.\n          </p>\n        </div>\n      </div>\n      \n      <div class="center" style="text-align: center;">\n        <div class="footer" style="margin-top: 24pt; padding: 18pt; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">\n          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" width="113" style="width: 113px; height: auto; display: inline-block; border: 0;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export interface TemplateVariableInfo {
  tag: string;
  label: string;
  description: string;
  sampleValue: string;
}

export interface EmailTemplateMeta {
  key: EmailTemplateKey;
  name: string;
  badge: string;
  subjectDefault: string;
  description: string;
  n8nNode: string;
  triggerDescription: string;
  defaultHtml: string;
  isCuratedOnly: boolean;
  variables: TemplateVariableInfo[];
}

export const EMAIL_TEMPLATE_VARIABLES: Record<EmailTemplateKey, TemplateVariableInfo[]> = {
  interest: [
    {
      tag: "{{ $('event-params').item.json.eventName }}",
      label: "Event Name",
      description: "Name of the GDG event from event-params node",
      sampleValue: "Cloud Community Day Jakarta 2026",
    },
    {
      tag: "{{ $('event-params').item.json.eventHeaderUrl }}",
      label: "Header Banner URL",
      description: "Banner image URL for the email header",
      sampleValue: "https://assets.gdgjakarta.org/gdg-jakarta/banner-sample.png",
    },
    {
      tag: "{{ $('event-params').item.json.eventActionUrl }}",
      label: "Event Details URL",
      description: "Link to event page on GDG Community or dashboard",
      sampleValue: "https://gdg.community.dev/events/details/developer-student-clubs-jakarta",
    },
    {
      tag: "{{ $('loop-send-email').item.json['Full Name'] }}",
      label: "Attendee Full Name",
      description: "Recipient full name from loop iteration",
      sampleValue: "Alex Pratama",
    },
    {
      tag: "{{ $('event-params').item.json.eventChecklistItems }}",
      label: "Checklist Items",
      description: "Rendered HTML registration checklist block configured on dashboard",
      sampleValue: "Registration Notes",
    },
  ],
  accepted: [
    {
      tag: "{{ $('bevy-config').item.json.bevyEventName }}",
      label: "Event Name",
      description: "Event name configured from Bevy sync",
      sampleValue: "Cloud Community Day Jakarta 2026",
    },
    {
      tag: "{{ $('bevy-config').item.json.bevyUserName }}",
      label: "Attendee Full Name",
      description: "Approved attendee name",
      sampleValue: "Alex Pratama",
    },
    {
      tag: "{{ $('bevy-config').item.json.bevyEventDate }}",
      label: "Event Date",
      description: "Formatted event date string",
      sampleValue: "Saturday, 25 October 2026",
    },
    {
      tag: "{{ $('session-config').item.json.bevySessionTime }}",
      label: "Session Time",
      description: "Selected session time window",
      sampleValue: "09:00 - 17:00 WIB",
    },
    {
      tag: "{{ $('session-config').item.json.bevyCheckinDeadline }}",
      label: "Check-in Deadline",
      description: "Latest arrival time before seat forfeiture",
      sampleValue: "10:30 WIB",
    },
    {
      tag: "{{ $('bevy-config').item.json.bevyEventLocation }}",
      label: "Venue Name / Address",
      description: "Event venue name and city",
      sampleValue: "Google Indonesia, Pacific Century Place Level 45, SCBD",
    },
    {
      tag: "{{ $('bevy-config').item.json.bevyEventLocationUrl }}",
      label: "Google Maps URL",
      description: "Directions map URL for the venue",
      sampleValue: "https://maps.google.com/?q=Pacific+Century+Place+Jakarta",
    },
    {
      tag: "{{ $('bevy-config').item.json.bevyEventHeaderEmailUrl }}",
      label: "Header Banner URL",
      description: "Email header banner image URL",
      sampleValue: "https://assets.gdgjakarta.org/gdg-jakarta/banner-sample.png",
    },
    {
      tag: "{{ $('Generate QR Code').item.json.qrCode }}",
      label: "Base64 QR Code",
      description: "Base64 PNG QR code string from Generate QR Code node",
      sampleValue: SAMPLE_QR_CODE_BASE64,
    },
    {
      tag: "{{ $('event-params').item.json.eventChecklistItems }}",
      label: "Checklist Items",
      description: "Rendered HTML checklist items block configured on dashboard",
      sampleValue: "Attendee Checklist",
    },
    {
      tag: "{{ $('Add Bevy Attendee API').item.json.attendee_code }}",
      label: "Attendee Reference Code",
      description: "Unique attendee reference code from Add Bevy Attendee API response",
      sampleValue: "GDG-JKT-89241",
    },
    {
      tag: "{{ $('Add Bevy Attendee API').item.json.id }}",
      label: "Bevy Attendee ID",
      description: "Numeric attendee ID fallback from Add Bevy Attendee API response",
      sampleValue: "2793132",
    },
  ],
  rejected_hybrid: [
    {
      tag: "{{ $('email-config').item.json.eventName }}",
      label: "Event Name",
      description: "Event name configured for the email",
      sampleValue: "Cloud Community Day Jakarta 2026",
    },
    {
      tag: "{{ $('loop-send-rejected-email').item.json['Full Name'] }}",
      label: "Attendee Full Name",
      description: "Recipient full name from rejected list loop",
      sampleValue: "Alex Pratama",
    },
    {
      tag: "{{ $('email-config').item.json.eventHeaderEmailUrl }}",
      label: "Header Banner URL",
      description: "Email header image banner URL",
      sampleValue: "https://assets.gdgjakarta.org/gdg-jakarta/banner-sample.png",
    },
    {
      tag: "{{ $('email-config').item.json.actionButtonUrl }}",
      label: "Updates / Livestream URL",
      description: "Action button URL to follow updates or stream",
      sampleValue: "https://youtube.com/@gdgjakarta/live",
    },
    {
      tag: "{{ $('event-params').item.json.eventChecklistItems }}",
      label: "Checklist Items",
      description: "Rendered HTML checklist items block configured on dashboard",
      sampleValue: "Next Steps & Alternatives",
    },
  ],
  rejected_non_hybrid: [
    {
      tag: "{{ $('email-config').item.json.eventName }}",
      label: "Event Name",
      description: "Event name configured for the email",
      sampleValue: "Cloud Community Day Jakarta 2026",
    },
    {
      tag: "{{ $('loop-send-rejected-email').item.json['Full Name'] }}",
      label: "Attendee Full Name",
      description: "Recipient full name from rejected list loop",
      sampleValue: "Alex Pratama",
    },
    {
      tag: "{{ $('email-config').item.json.eventHeaderEmailUrl }}",
      label: "Header Banner URL",
      description: "Email header image banner URL",
      sampleValue: "https://assets.gdgjakarta.org/gdg-jakarta/banner-sample.png",
    },
    {
      tag: "{{ $('email-config').item.json.actionButtonUrl }}",
      label: "Community Updates URL",
      description: "Action button URL to keep in touch with GDG",
      sampleValue: "https://gdg.community.dev/gdg-jakarta",
    },
    {
      tag: "{{ $('event-params').item.json.eventChecklistItems }}",
      label: "Checklist Items",
      description: "Rendered HTML checklist items block configured on dashboard",
      sampleValue: "Important Community Notes",
    },
  ],
  rejected_virtual: [
    {
      tag: "{{ $('email-config').item.json.eventName }}",
      label: "Event Name",
      description: "Event name configured for the email",
      sampleValue: "Cloud Community Day Jakarta 2026",
    },
    {
      tag: "{{ $('loop-send-rejected-email').item.json['Full Name'] }}",
      label: "Attendee Full Name",
      description: "Recipient full name from rejected list loop",
      sampleValue: "Alex Pratama",
    },
    {
      tag: "{{ $('email-config').item.json.eventHeaderEmailUrl }}",
      label: "Header Banner URL",
      description: "Email header image banner URL",
      sampleValue: "https://assets.gdgjakarta.org/gdg-jakarta/banner-sample.png",
    },
    {
      tag: "{{ $('email-config').item.json.actionButtonUrl }}",
      label: "Community Events URL",
      description: "Action button URL to explore community updates",
      sampleValue: "https://gdg.community.dev/gdg-jakarta",
    },
    {
      tag: "{{ $('event-params').item.json.eventChecklistItems }}",
      label: "Checklist Items",
      description: "Rendered HTML checklist items block configured on dashboard",
      sampleValue: "Next Steps & Online Resources",
    },
  ],
  cancelled: [
    {
      tag: "{{ $('event-params').item.json.eventName }}",
      label: "Event Name",
      description: "Name of the GDG event",
      sampleValue: "Cloud Community Day Jakarta 2026",
    },
    {
      tag: "{{ $('event-params').item.json.eventHeaderUrl }}",
      label: "Header Banner URL",
      description: "Banner image URL for the email header",
      sampleValue: "https://assets.gdgjakarta.org/gdg-jakarta/banner-sample.png",
    },
    {
      tag: "{{ $('event-params').item.json.eventActionUrl }}",
      label: "Event Re-Registration URL",
      description: "Link to event page for re-registering",
      sampleValue: "https://gdg.community.dev/events/details/developer-student-clubs-jakarta",
    },
    {
      tag: "{{ $('loop-send-email').item.json['Full Name'] }}",
      label: "Attendee Full Name",
      description: "Recipient full name",
      sampleValue: "Alex Pratama",
    },
    {
      tag: "{{ $('event-params').item.json.cancellationReason }}",
      label: "Cancellation Reason",
      description: "Reason provided by the organizer for cancelling the registration",
      sampleValue: "Incomplete registration profile or duplicate submission.",
    },
    {
      tag: "{{ $('event-params').item.json.eventChecklistItems }}",
      label: "Checklist Items",
      description: "Rendered HTML cancellation details and instructions",
      sampleValue: "Cancellation Notes",
    },
  ],
  cancelled_attendee: [
    {
      tag: "{{ $('event-params').item.json.eventName }}",
      label: "Event Name",
      description: "Name of the GDG event",
      sampleValue: "Cloud Community Day Jakarta 2026",
    },
    {
      tag: "{{ $('event-params').item.json.eventHeaderUrl }}",
      label: "Header Banner URL",
      description: "Banner image URL for the email header",
      sampleValue: "https://assets.gdgjakarta.org/gdg-jakarta/banner-sample.png",
    },
    {
      tag: "{{ $('event-params').item.json.eventActionUrl }}",
      label: "Event Re-Registration URL",
      description: "Link to event page for re-registering",
      sampleValue: "https://gdg.community.dev/events/details/developer-student-clubs-jakarta",
    },
    {
      tag: "{{ $('loop-send-email').item.json['Full Name'] }}",
      label: "Attendee Full Name",
      description: "Recipient full name",
      sampleValue: "Alex Pratama",
    },
    {
      tag: "{{ $('event-params').item.json.eventChecklistItems }}",
      label: "Checklist Items",
      description: "Rendered HTML cancellation details and instructions",
      sampleValue: "Cancellation Notes",
    },
  ],
  waitlisted: [
    {
      tag: "{{ $('event-params').item.json.eventName }}",
      label: "Event Name",
      description: "Name of the GDG event",
      sampleValue: "Cloud Community Day Jakarta 2026",
    },
    {
      tag: "{{ $('event-params').item.json.eventHeaderUrl }}",
      label: "Header Banner URL",
      description: "Banner image URL for the email header",
      sampleValue: "https://assets.gdgjakarta.org/gdg-jakarta/banner-sample.png",
    },
    {
      tag: "{{ $('event-params').item.json.eventActionUrl }}",
      label: "Event Details URL",
      description: "Link to event page on GDG Community or dashboard",
      sampleValue: "https://gdg.community.dev/events/details/developer-student-clubs-jakarta",
    },
    {
      tag: "{{ $('loop-send-email').item.json['Full Name'] }}",
      label: "Attendee Full Name",
      description: "Recipient full name",
      sampleValue: "Alex Pratama",
    },
    {
      tag: "{{ $('event-params').item.json.eventChecklistItems }}",
      label: "Checklist Items",
      description: "Rendered HTML waitlist notes and guidelines",
      sampleValue: "Waitlist Notes",
    },
  ],
  paid_waitlisted: [
    {
      tag: "{{ $('event-params').item.json.eventName }}",
      label: "Event Name",
      description: "Name of the GDG event",
      sampleValue: "Cloud Community Day Jakarta 2026",
    },
    {
      tag: "{{ $('event-params').item.json.eventHeaderUrl }}",
      label: "Header Banner URL",
      description: "Banner image URL for the email header",
      sampleValue: "https://assets.gdgjakarta.org/gdg-jakarta/banner-sample.png",
    },
    {
      tag: "{{ $('event-params').item.json.eventActionUrl }}",
      label: "Event Details URL",
      description: "Link to event page on GDG Community or dashboard",
      sampleValue: "https://gdg.community.dev/events/details/developer-student-clubs-jakarta",
    },
    {
      tag: "{{ $('loop-send-email').item.json['Full Name'] }}",
      label: "Attendee Full Name",
      description: "Recipient full name",
      sampleValue: "Alex Pratama",
    },
    {
      tag: "{{ invoice_number }}",
      label: "Invoice Number",
      description: "DOKU invoice payment reference number",
      sampleValue: "INV-1792031921352-132640",
    },
    {
      tag: "{{ paid_amount }}",
      label: "Amount Paid",
      description: "Formatted ticket/commitment fee payment amount",
      sampleValue: "Rp 100.500",
    },
    {
      tag: "{{ session_name }}",
      label: "Session Track / Ticket",
      description: "Selected session track or ticket tier name",
      sampleValue: "Super Early Bird",
    },
    {
      tag: "{{ $('event-params').item.json.eventChecklistItems }}",
      label: "Checklist Items",
      description: "Rendered HTML paid waitlist guidelines and refund guarantees",
      sampleValue: "Paid Waitlist Guidelines",
    },
  ],
  rejected_waitlisted: [
    {
      tag: "{{ $('event-params').item.json.eventName }}",
      label: "Event Name",
      description: "Name of the GDG event",
      sampleValue: "Cloud Community Day Jakarta 2026",
    },
    {
      tag: "{{ $('event-params').item.json.eventHeaderUrl }}",
      label: "Header Banner URL",
      description: "Banner image URL for the email header",
      sampleValue: "https://assets.gdgjakarta.org/gdg-jakarta/banner-sample.png",
    },
    {
      tag: "{{ $('event-params').item.json.eventActionUrl }}",
      label: "Event Details URL",
      description: "Link to event page on GDG Community or dashboard",
      sampleValue: "https://gdg.community.dev/events/details/developer-student-clubs-jakarta",
    },
    {
      tag: "{{ $('loop-send-email').item.json['Full Name'] }}",
      label: "Attendee Full Name",
      description: "Recipient full name",
      sampleValue: "Alex Pratama",
    },
    {
      tag: "{{ $('event-params').item.json.eventChecklistItems }}",
      label: "Checklist Items",
      description: "Rendered HTML waitlist closure notes and community updates",
      sampleValue: "Waitlist Closure Notes",
    },
  ],
  rejected_paid_waitlisted: [
    {
      tag: "{{ $('event-params').item.json.eventName }}",
      label: "Event Name",
      description: "Name of the GDG event",
      sampleValue: "Cloud Community Day Jakarta 2026",
    },
    {
      tag: "{{ $('event-params').item.json.eventHeaderUrl }}",
      label: "Header Banner URL",
      description: "Banner image URL for the email header",
      sampleValue: "https://assets.gdgjakarta.org/gdg-jakarta/banner-sample.png",
    },
    {
      tag: "{{ $('event-params').item.json.eventActionUrl }}",
      label: "Dashboard / Refund URL",
      description: "Link to member dashboard to submit a refund request",
      sampleValue: "https://gdgjakarta.org/dashboard/my-events",
    },
    {
      tag: "{{ $('loop-send-email').item.json['Full Name'] }}",
      label: "Attendee Full Name",
      description: "Recipient full name",
      sampleValue: "Alex Pratama",
    },
    {
      tag: "{{ invoice_number }}",
      label: "Invoice Number",
      description: "DOKU invoice payment reference number",
      sampleValue: "INV-1792031921352-132640",
    },
    {
      tag: "{{ paid_amount }}",
      label: "Amount Paid",
      description: "Formatted ticket/commitment fee payment amount",
      sampleValue: "Rp 100.500",
    },
    {
      tag: "{{ session_name }}",
      label: "Session Track / Ticket",
      description: "Selected session track or ticket tier name",
      sampleValue: "Super Early Bird",
    },
    {
      tag: "{{ $('event-params').item.json.eventChecklistItems }}",
      label: "Checklist Items",
      description: "Rendered HTML refund request guidelines",
      sampleValue: "Refund Guidelines",
    },
  ],
};

export const EMAIL_TEMPLATES_CONFIG: EmailTemplateMeta[] = [
  {
    key: "interest",
    name: "Registration Interest (Receipt)",
    badge: "Curated Flow • Step 1",
    subjectDefault: "Registration Received: {{ $('event-params').item.json.eventName }}",
    description:
      "Sent immediately when an attendee registers for a curated event. Confirms receipt and informs them of the curation process.",
    n8nNode: "loop-send-email",
    triggerDescription: "Triggered on registration webhook received (Status: Pending Review)",
    defaultHtml: DEFAULT_INTEREST_EMAIL_HTML,
    isCuratedOnly: true,
    variables: EMAIL_TEMPLATE_VARIABLES.interest,
  },
  {
    key: "accepted",
    name: "Accepted / Ticket Confirmation",
    badge: "Direct & Curated Pass",
    subjectDefault: "Your Official Ticket & Reminders: {{ $('bevy-config').item.json.bevyEventName }}",
    description:
      "Sent when an attendee is approved (or immediately upon RSVP for non-curated events). Includes the official entry QR code, venue details, and attendee checklist.",
    n8nNode: "loop-send-approved",
    triggerDescription: "Triggered when organizer marks attendee as Approved (or on instant RSVP if not curated)",
    defaultHtml: DEFAULT_ACCEPTED_EMAIL_HTML,
    isCuratedOnly: false,
    variables: EMAIL_TEMPLATE_VARIABLES.accepted,
  },
  {
    key: "waitlisted",
    name: "Waitlist Notification (Free/Unpaid)",
    badge: "Waitlist Notice",
    subjectDefault: "Waitlist Update: {{ $('event-params').item.json.eventName }}",
    description:
      "Sent when an attendee's registration is moved to the waitlist during curation or free registration. Informs them that they are placed on the waitlist without payment.",
    n8nNode: "loop-send-email",
    triggerDescription:
      "Triggered when organizer moves an attendee to Waitlisted status or event capacity engages waitlist",
    defaultHtml: DEFAULT_WAITLISTED_EMAIL_HTML,
    isCuratedOnly: false,
    variables: EMAIL_TEMPLATE_VARIABLES.waitlisted,
  },
  {
    key: "paid_waitlisted",
    name: "Paid Waitlist Notification",
    badge: "Payment Verified • Capacity Full",
    subjectDefault: "Payment Confirmed - Waitlist Priority: {{ $('event-params').item.json.eventName }}",
    description:
      "Sent automatically when an attendee completes payment via DOKU, but the session has reached maximum capacity. Confirms payment receipt and explains priority waitlist & refund options.",
    n8nNode: "add-bevy-attendee",
    triggerDescription: "Triggered on DOKU Payment Success when Bevy session capacity is full",
    defaultHtml: DEFAULT_PAID_WAITLISTED_EMAIL_HTML,
    isCuratedOnly: false,
    variables: EMAIL_TEMPLATE_VARIABLES.paid_waitlisted,
  },
  {
    key: "rejected_waitlisted",
    name: "Rejected Waitlisted",
    badge: "Free Event • Waitlist Closed",
    subjectDefault: "Waitlist Update: {{ $('event-params').item.json.eventName }}",
    description: "Sent when an organizer rejects a waitlisted attendee on a free event because capacity remained full.",
    n8nNode: "loop-send-email",
    triggerDescription: "Triggered when organizer marks a Waitlisted attendee as Rejected (Free Event)",
    defaultHtml: DEFAULT_REJECTED_WAITLISTED_EMAIL_HTML,
    isCuratedOnly: false,
    variables: EMAIL_TEMPLATE_VARIABLES.rejected_waitlisted,
  },
  {
    key: "rejected_paid_waitlisted",
    name: "Rejected Paid Waitlisted",
    badge: "Paid Event • Refund Eligible",
    subjectDefault: "Waitlist Update & Refund Instructions: {{ $('event-params').item.json.eventName }}",
    description:
      "Sent when an organizer rejects a paid waitlisted attendee on a paid event. Instructs them to submit a 100% refund request on their dashboard (exempt from refund cutoff dates).",
    n8nNode: "loop-send-email",
    triggerDescription: "Triggered when organizer marks a Paid Waitlisted attendee as Rejected (Paid Event)",
    defaultHtml: DEFAULT_REJECTED_PAID_WAITLISTED_EMAIL_HTML,
    isCuratedOnly: false,
    variables: EMAIL_TEMPLATE_VARIABLES.rejected_paid_waitlisted,
  },
  {
    key: "rejected_hybrid",
    name: "Application Regret (Hybrid Event)",
    badge: "Curated Flow • Step 2 (Option A)",
    subjectDefault: "Update regarding: {{ $('email-config').item.json.eventName }}",
    description:
      "Polite rejection notice for curated hybrid events. Informs attendees of capacity limits while providing a link to follow livestream or community updates.",
    n8nNode: "loop-send-rejected-email",
    triggerDescription: "Triggered when organizer marks attendee as Rejected (Hybrid / Livestream track)",
    defaultHtml: DEFAULT_REJECTED_HYBRID_EMAIL_HTML,
    isCuratedOnly: true,
    variables: EMAIL_TEMPLATE_VARIABLES.rejected_hybrid,
  },
  {
    key: "rejected_non_hybrid",
    name: "Application Regret (In-Person Only)",
    badge: "Curated Flow • Step 2 (Option B)",
    subjectDefault: "Update regarding: {{ $('email-config').item.json.eventName }}",
    description: "Polite rejection notice for strictly in-person physical events with limited venue space.",
    n8nNode: "loop-send-rejected-email",
    triggerDescription: "Triggered when organizer marks attendee as Rejected (In-person capacity full)",
    defaultHtml: DEFAULT_REJECTED_NON_HYBRID_EMAIL_HTML,
    isCuratedOnly: true,
    variables: EMAIL_TEMPLATE_VARIABLES.rejected_non_hybrid,
  },
  {
    key: "rejected_virtual",
    name: "Application Regret (Virtual Event)",
    badge: "Curated Flow • Step 2 (Option C)",
    subjectDefault: "Update regarding: {{ $('email-config').item.json.eventName }}",
    description:
      "Polite rejection notice for curated online/virtual events with limited interactive session or workshop slots.",
    n8nNode: "loop-send-rejected-email",
    triggerDescription: "Triggered when organizer marks attendee as Rejected (Virtual Event)",
    defaultHtml: DEFAULT_REJECTED_VIRTUAL_EMAIL_HTML,
    isCuratedOnly: true,
    variables: EMAIL_TEMPLATE_VARIABLES.rejected_virtual,
  },
  {
    key: "cancelled",
    name: "Registration Cancelled (Organizer)",
    badge: "Cancellation Notice",
    subjectDefault: "Registration Cancelled: {{ $('event-params').item.json.eventName }}",
    description:
      "Sent when an organizer cancels an attendee's registration and removes them from the event roster. Notifies the user they have been removed and must re-register if they change their mind.",
    n8nNode: "loop-send-email",
    triggerDescription: "Triggered when organizer cancels registration and removes attendee on dashboard",
    defaultHtml: DEFAULT_CANCELLED_EMAIL_HTML,
    isCuratedOnly: false,
    variables: EMAIL_TEMPLATE_VARIABLES.cancelled,
  },
  {
    key: "cancelled_attendee",
    name: "Registration Cancelled (Attendee)",
    badge: "Self-Service Notice",
    subjectDefault: "Registration Cancelled: {{ $('event-params').item.json.eventName }}",
    description:
      "Sent when an attendee cancels their own registration from their member dashboard or event details page. Informs them their registration is removed and that they must re-register if they change their mind.",
    n8nNode: "loop-send-email",
    triggerDescription: "Triggered when attendee confirms cancellation in member dashboard or event page",
    defaultHtml: DEFAULT_CANCELLED_ATTENDEE_EMAIL_HTML,
    isCuratedOnly: false,
    variables: EMAIL_TEMPLATE_VARIABLES.cancelled_attendee,
  },
];

export const CUSTOM_DEFAULT_TEMPLATES_KEY = "gdg_custom_default_email_templates";
export const CUSTOM_DEFAULT_TEMPLATES_DATA_KEY = "gdg_custom_default_templates_data";

export function getCustomDefaultTemplates(): Partial<Record<EmailTemplateKey, string>> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CUSTOM_DEFAULT_TEMPLATES_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCustomDefaultTemplates(templates: Record<EmailTemplateKey, string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_DEFAULT_TEMPLATES_KEY, JSON.stringify(templates));
  } catch (err) {
    console.warn("[saveCustomDefaultTemplates] Failed to save custom templates:", err);
  }
}

export function getCustomDefaultTemplatesData(): Partial<Record<EmailTemplateKey, TemplateSimulatedData>> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CUSTOM_DEFAULT_TEMPLATES_DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCustomDefaultTemplatesData(data: Record<EmailTemplateKey, TemplateSimulatedData>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_DEFAULT_TEMPLATES_DATA_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("[saveCustomDefaultTemplatesData] Failed to save custom template data:", err);
  }
}

export function clearCustomDefaults(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CUSTOM_DEFAULT_TEMPLATES_KEY);
    window.localStorage.removeItem(CUSTOM_DEFAULT_TEMPLATES_DATA_KEY);
  } catch {
    // Ignore
  }
}

export function getFactoryDefaultTemplateByKey(key: EmailTemplateKey): string {
  switch (key) {
    case "interest":
      return DEFAULT_INTEREST_EMAIL_HTML;
    case "accepted":
      return DEFAULT_ACCEPTED_EMAIL_HTML;
    case "rejected_hybrid":
      return DEFAULT_REJECTED_HYBRID_EMAIL_HTML;
    case "rejected_non_hybrid":
      return DEFAULT_REJECTED_NON_HYBRID_EMAIL_HTML;
    case "rejected_virtual":
      return DEFAULT_REJECTED_VIRTUAL_EMAIL_HTML;
    case "cancelled":
      return DEFAULT_CANCELLED_EMAIL_HTML;
    case "cancelled_attendee":
      return DEFAULT_CANCELLED_ATTENDEE_EMAIL_HTML;
    case "waitlisted":
      return DEFAULT_WAITLISTED_EMAIL_HTML;
    case "paid_waitlisted":
      return DEFAULT_PAID_WAITLISTED_EMAIL_HTML;
    case "rejected_waitlisted":
      return DEFAULT_REJECTED_WAITLISTED_EMAIL_HTML;
    case "rejected_paid_waitlisted":
      return DEFAULT_REJECTED_PAID_WAITLISTED_EMAIL_HTML;
    default:
      return "";
  }
}

export function getDefaultTemplateByKey(key: EmailTemplateKey): string {
  const custom = getCustomDefaultTemplates();
  const customHtml = custom?.[key];
  if (customHtml) {
    return customHtml;
  }
  return getFactoryDefaultTemplateByKey(key);
}

export interface TemplateAttendeeData {
  name: string;
  email: string;
}

export interface TemplateEventData {
  headerEmailUrl: string;
  eventName: string;
  eventCtaUrl: string;
  eventChecklistItems: string[];
}

export interface TemplateSimulatedData {
  attendee: TemplateAttendeeData;
  event: TemplateEventData;
  sessionTime?: string;
  checkinDeadline?: string;
  overrideSessionTime?: string;
  overrideCheckinDeadline?: string;
  venueLocation?: string;
  venueLocationUrl?: string;
  eventDate?: string;
  qrCode?: string;
  attendeeCode?: string;
  attendeeId?: string | number;
  invoiceNumber?: string;
  paidAmount?: string;
  sessionName?: string;
  cancellationReason?: string;
}

export const DEFAULT_INTEREST_CHECKLIST_ITEMS: string[] = [
  "Receipt of Registration Only: This email confirms your registration request has been received. It is NOT an entry ticket.",
  "Participant Curation: Our organizing team will curate registrations, prioritizing industry professionals for meaningful networking.",
  "Outcome Notification: Selected participants will receive a separate follow-up email with their Official Confirmation Pass.",
  "Check Inbox Regularly: Please keep an eye on your inbox and spam folder for final selection updates before the event.",
];

export const DEFAULT_ACCEPTED_CHECKLIST_ITEMS: string[] = [
  "First-Come, First-Served Basis: Please arrive early! Seating is limited and entry operates strictly on a first-come, first-served basis. If the session is full, unfortunately, we won't be able to let you in.",
  "Bring Your Laptop: Please ensure your laptop is fully charged before arriving, as power outlets may be limited.",
  "ID Verification: Bring your KTP/SIM (Physical ID) for building access and check-in verification. Also, have this QR code ready on your phone (brightness up!).",
  "Check-in Deadline: Registration closes strictly after the event starts. Late arrivals may be denied entry.",
];

export const DEFAULT_REJECTED_HYBRID_CHECKLIST_ITEMS: string[] = [
  "Livestream Access: Tune in to our live broadcast on YouTube to catch keynote presentations and panel sessions.",
  "Community Discussions: Join the open discussion threads on our community Discord / WhatsApp channels.",
  "Future Events: Stay tuned on GDG Community Dev for upcoming workshops and meetups.",
];

export const DEFAULT_REJECTED_NON_HYBRID_CHECKLIST_ITEMS: string[] = [
  "Waitlist Consideration: In the event of participant cancellations, spots will be allocated to waitlisted applicants.",
  "Upcoming Meetups: Keep an eye on our community page for announcements on upcoming in-person meetups.",
];

export const DEFAULT_REJECTED_VIRTUAL_CHECKLIST_ITEMS: string[] = [
  "Session Recordings: Keynote and workshop recordings will be published on our YouTube channel following the event.",
  "Community Discussions: Join the open discussion channels on our Discord and WhatsApp community groups.",
  "Upcoming Virtual Workshops: Keep an eye on GDG Community Dev for upcoming webinars and hands-on codelabs.",
];

export const DEFAULT_CANCELLED_CHECKLIST_ITEMS: string[] = [
  "Registration Cancelled: Your registration for this event has been cancelled by the event organizer.",
  "Roster Removal: Your record and pass have been removed from the official attendee roster.",
  "Capacity Released: Your allocated seat/spot has been released back to the event capacity pool.",
  "Re-Registration: If you change your mind, you need to re-register again through the event page while seats remain.",
];

export const DEFAULT_CANCELLED_ATTENDEE_CHECKLIST_ITEMS: string[] = [
  "Registration Canceled: Your registration has been canceled and your registration will be removed from the event.",
  "Roster Removal: Your record and allocated pass have been removed from the official attendee roster.",
  "Capacity Released: Your spot has been released and made available for waitlisted or new applicants.",
  "Re-Registration: If you change your mind, you need to re-register again through the event page while seats remain.",
];

export const DEFAULT_WAITLISTED_CHECKLIST_ITEMS: string[] = [
  "Waitlist Status: You are currently on the waitlist. This email confirms your position but is NOT an entrance pass.",
  "Automatic Reallocation: If registered attendees cancel their tickets, spots are allocated directly to waitlisted participants.",
  "Notification via Email: You will receive an official ticket pass and QR code if a seat opens up for you before the event.",
  "No Walk-Ins: Please do not travel to the venue unless you receive a confirmed ticket, as entry is strictly restricted by building security.",
];

export const DEFAULT_PAID_WAITLISTED_CHECKLIST_ITEMS: string[] = [
  "Payment Confirmed: Your payment has been received and verified by DOKU payment gateway.",
  "Priority Waitlist Position: You are prioritized at the top of the queue ahead of unpaid waitlisted participants.",
  "Automatic Ticket Delivery: Your official QR code pass will be issued immediately via email once a seat opens up.",
  "Refund or Session Transfer: If we cannot accommodate your seat before the event, you will receive a full refund or track transfer.",
];

export const DEFAULT_REJECTED_WAITLISTED_CHECKLIST_ITEMS: string[] = [
  "Waitlist Closed: All confirmed attendee spots remained filled and no additional capacity opened up.",
  "Upcoming Events: Follow our GDG Jakarta chapter page for announcements on upcoming workshops and meetups.",
  "Community Channels: Join our open community discussions on Discord and social channels.",
];

export const DEFAULT_REJECTED_PAID_WAITLISTED_CHECKLIST_ITEMS: string[] = [
  "100% Full Refund Guarantee: Because we could not accommodate your seat from the paid waitlist, you are entitled to a full refund.",
  "No Deadline Restriction: You can submit your refund request on your dashboard even if the standard refund cutoff date has passed.",
  "Dashboard Submission: Sign in to your GDG Jakarta dashboard, go to My Events, and click Request Refund to provide your bank/e-wallet details.",
];

export const DEFAULT_CHECKLIST_ITEMS_BY_TYPE: Record<EmailTemplateKey, string[]> = {
  interest: DEFAULT_INTEREST_CHECKLIST_ITEMS,
  accepted: DEFAULT_ACCEPTED_CHECKLIST_ITEMS,
  rejected_hybrid: DEFAULT_REJECTED_HYBRID_CHECKLIST_ITEMS,
  rejected_non_hybrid: DEFAULT_REJECTED_NON_HYBRID_CHECKLIST_ITEMS,
  rejected_virtual: DEFAULT_REJECTED_VIRTUAL_CHECKLIST_ITEMS,
  cancelled: DEFAULT_CANCELLED_CHECKLIST_ITEMS,
  cancelled_attendee: DEFAULT_CANCELLED_ATTENDEE_CHECKLIST_ITEMS,
  waitlisted: DEFAULT_WAITLISTED_CHECKLIST_ITEMS,
  paid_waitlisted: DEFAULT_PAID_WAITLISTED_CHECKLIST_ITEMS,
  rejected_waitlisted: DEFAULT_REJECTED_WAITLISTED_CHECKLIST_ITEMS,
  rejected_paid_waitlisted: DEFAULT_REJECTED_PAID_WAITLISTED_CHECKLIST_ITEMS,
};

export const DEFAULT_CHECKLIST_ITEMS: string[] = DEFAULT_ACCEPTED_CHECKLIST_ITEMS;

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const clean = (fullName || "").trim();
  if (!clean) return { firstName: "Attendee", lastName: "" };
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function renderChecklistItemsHtml(items: string[]): string {
  if (items.length === 0) return "";

  const icons = ["🚨", "💻", "🪪", "⏰", "✨", "📌", "ℹ️"];

  return items
    .map((item, idx) => {
      const icon = icons[idx % icons.length];
      const colonIndex = item.indexOf(":");
      let titleHtml = "";
      let descHtml = item;
      if (colonIndex > -1) {
        titleHtml = `<strong>${item.slice(0, colonIndex).trim()}</strong><br>`;
        descHtml = item.slice(colonIndex + 1).trim();
      }
      return `
            <div class="checklist-item" style="margin-bottom: 15px; display: flex; align-items: flex-start;">
                <span class="icon" style="margin-right: 12px; font-size: 1.2em; min-width: 25px;">${icon}</span>
                <div class="text" style="font-size: 0.95em; line-height: 1.5;">
                    ${titleHtml}${descHtml}
                </div>
            </div>`;
    })
    .join("\n");
}

/**
 * Replaces the entire inner content of <div class="checklist-box"> (after the <h3> heading)
 * up to its matching closing </div> without accidentally duplicating items.
 */
export function replaceChecklistBoxContent(html: string, newChecklistItemsHtml: string): string {
  const boxStartStr = '<div class="checklist-box">';
  const boxStartIdx = html.indexOf(boxStartStr);
  if (boxStartIdx === -1) return html;

  let depth = 0;
  let closingBoxIdx = -1;
  const tagRegex = /<\/?div\b[^>]*>/gi;
  tagRegex.lastIndex = boxStartIdx;

  let match = tagRegex.exec(html);
  while (match !== null) {
    if (match[0].startsWith("</")) {
      depth--;
      if (depth === 0) {
        closingBoxIdx = match.index;
        break;
      }
    } else {
      depth++;
    }
    match = tagRegex.exec(html);
  }

  if (closingBoxIdx === -1) return html;

  const boxInnerHtml = html.slice(boxStartIdx + boxStartStr.length, closingBoxIdx);
  const h3Match = /<h3[^>]*>[\s\S]*?<\/h3>/i.exec(boxInnerHtml);
  if (!h3Match) return html;

  const headerEndRel = h3Match.index + h3Match[0].length;
  const headerEndAbs = boxStartIdx + boxStartStr.length + headerEndRel;

  return `${html.slice(0, headerEndAbs)}\n${newChecklistItemsHtml}\n          ${html.slice(closingBoxIdx)}`;
}

/**
 * Ensures "See you at the venue! 🚀" is rendered as a styled blue pill button
 * and the footer branding has resilient inline CSS so it renders consistently in Gmail.
 */
export function ensureVenueButtonAndFooterInHtml(html: string): string {
  let updated = html;

  // 1. Convert plain text or unstyled <p> "See you at the venue! 🚀" to an inline-styled button
  const pVenueRegex = /<p\b[^>]*>\s*See you at the venue!\s*(?:🚀|\\ud83d\\ude80|\ud83d\ude80)\s*<\/p>/gi;
  const buttonHtml = `<div style="text-align: center; margin: 25px 0 10px 0;">
            <div class="btn" style="display: inline-block; background-color: #4285f4; color: #ffffff !important; text-align: center; border-radius: 50px; padding: 12px 36px; font-weight: 600; font-size: 15px; text-decoration: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              See you at the venue! 🚀
            </div>
          </div>`;
  if (pVenueRegex.test(updated)) {
    updated = updated.replace(pVenueRegex, buttonHtml);
  }

  // 2. Fix broken legacy asset path if present
  updated = updated.replaceAll(
    "https://assets.gdgjakarta.org/gdg-sign-bubble-transparent.png",
    "https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png",
  );

  // 3. Ensure footer container has resilient inline styling for Gmail compatibility
  updated = updated.replace(
    /<div\b(?=[^>]*\bclass=["'][^"']*\bfooter\b[^"']*["'])(?![^>]*\bstyle=)[^>]*>/gi,
    '<div class="footer" style="margin-top: 24pt; padding: 18pt; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">',
  );

  return updated;
}

/**
 * Ensures the attendee ID is displayed below Ref inside .attendee-id
 * in accepted / ticket confirmation emails.
 */
export function ensureAttendeeIdInAcceptedHtml(html: string): string {
  let result = html;
  if (!result.includes("ticket-card") && !result.includes("attendee-id")) {
    return result;
  }

  result = result.replace(
    /(<div\b(?=[^>]*\bclass=["'][^"']*\battendee-id\b[^"']*["'])[^>]*>)([\s\S]*?)(<\/div>)/gi,
    (match, prefix, content, suffix) => {
      if (
        content.includes("item.json.id") ||
        content.includes("ID:") ||
        content.includes("[[AttendeeId]]") ||
        content.includes("{{ attendeeId }}") ||
        content.includes("{{ $('Add Bevy Attendee API').item.json.id }}")
      ) {
        return match;
      }
      const quote = content.includes("\\'") ? "\\'" : "'";
      const idTag = `{{ $(${quote}Add Bevy Attendee API${quote}).item.json.id }}`;
      const trimmed = content.trim();
      if (trimmed.includes("<div>")) {
        return `${prefix}\n              ${trimmed}\n              <div style="margin-top: 2px;">ID: ${idTag}</div>\n            ${suffix}`;
      }
      return `${prefix}\n              <div>${trimmed}</div>\n              <div style="margin-top: 2px;">ID: ${idTag}</div>\n            ${suffix}`;
    },
  );

  return result;
}

/**
 * Ensures the cancellation reason section is present inside .alert-box
 * for cancelled email templates even if saved in Firestore before this update.
 */
export function ensureCancellationReasonInCancelledHtml(html: string): string {
  let result = html;
  if (
    !result.includes("cancellationReason") &&
    !result.includes("cancellation_reason") &&
    !result.includes("Reason for Cancellation:") &&
    !result.includes("[[CancellationReason]]") &&
    result.includes("alert-box")
  ) {
    const quote = result.includes("\\'") ? "\\'" : "'";
    const reasonBlock = `\n            <p><strong>Reason for Cancellation:</strong><br>{{ $(${quote}event-params${quote}).item.json.cancellationReason }}</p>\n          `;
    result = result.replace(
      /(<div\b[^>]*class=["'][^"']*alert-box[^"']*["'][^>]*>[\s\S]*?)(<\/div>)/i,
      `$1${reasonBlock}$2`,
    );
  }
  return result;
}

/**
 * Ensures the Check-in Deadline row is included in the accepted ticket details box
 * if the template contains session time but omits checkin deadline, and ensures
 * venue button and footer styling are properly applied.
 */
export function ensureCheckinDeadlineInAcceptedHtml(html: string): string {
  let result = html;
  if (
    !result.includes("bevyCheckinDeadline") &&
    !result.includes("Check-in Deadline") &&
    result.includes("details-box")
  ) {
    const timeRowRegex =
      /(<div\b[^>]*class=["'][^"']*detail-row[^"']*["'][^>]*>[\s\S]*?(?:bevySessionTime|Session Time)[\s\S]*?<\/div>[\s\S]*?<\/div>)/i;
    const match = timeRowRegex.exec(result);
    if (match) {
      const matchedRow = match[0];
      const quote = matchedRow.includes("\\'") ? "\\'" : "'";
      const checkinRow = `\n              <div class="detail-row">\n                <span class="detail-icon">⏳</span>\n                <div>\n                  <strong>Check-in Deadline</strong>\n                  <br>\n                  {{ $(${quote}session-config${quote}).item.json.bevyCheckinDeadline }}\n                </div>\n              </div>`;
      result = result.replace(matchedRow, `${matchedRow}${checkinRow}`);
    }
  }

  result = ensureAttendeeIdInAcceptedHtml(result);
  return ensureVenueButtonAndFooterInHtml(result);
}

export function formatBevySessionTime(startDate?: string, endDate?: string): string | undefined {
  if (!startDate) return undefined;
  try {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return undefined;
    const startTz = toTimezoneDate(start, "Asia/Jakarta");
    const startStr = format(startTz, "HH:mm");

    if (endDate) {
      const end = new Date(endDate);
      if (!Number.isNaN(end.getTime())) {
        const endTz = toTimezoneDate(end, "Asia/Jakarta");
        return `${startStr} - ${format(endTz, "HH:mm")} WIB`;
      }
    }
    return `${startStr} WIB`;
  } catch {
    return undefined;
  }
}

export function formatBevyCheckinDeadline(startDate?: string, offsetMinutes = 30): string | undefined {
  if (!startDate) return undefined;
  try {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return undefined;
    const deadline = new Date(start.getTime() + offsetMinutes * 60_000);
    const deadlineTz = toTimezoneDate(deadline, "Asia/Jakarta");
    return `${format(deadlineTz, "HH:mm")} WIB`;
  } catch {
    return undefined;
  }
}

export function getCleanDefaultTemplateDataForType(
  key: EmailTemplateKey,
  event: FirestoreEvent,
): TemplateSimulatedData {
  const customData = getCustomDefaultTemplatesData()?.[key];

  const defaultHeader =
    event.banner_url ??
    event.picture_url ??
    customData?.event?.headerEmailUrl ??
    "https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png";

  let defaultCta =
    event.url ?? event.static_url ?? customData?.event?.eventCtaUrl ?? "https://gdg.community.dev/gdg-jakarta";
  if (key === "rejected_hybrid") {
    defaultCta = customData?.event?.eventCtaUrl ?? "https://youtube.com/@gdgjakarta/live";
  }

  let eventDate = "Saturday, 25 October 2026";
  if (event.start_date) {
    try {
      const d = new Date(event.start_date);
      if (!Number.isNaN(d.getTime())) {
        eventDate = d.toLocaleDateString("en-US", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      }
    } catch {
      // Keep default
    }
  }

  const addressParts = [event.venue?.address, event.venue?.city].filter(Boolean).join(", ");
  const venueLocation =
    event.venue?.name ??
    (addressParts.length > 0
      ? addressParts
      : (customData?.venueLocation ?? "Google Indonesia, Pacific Century Place Level 45, SCBD"));
  const venueLocationQuery = [event.venue?.name, event.venue?.address, event.venue?.city].filter(Boolean).join(", ");
  const venueLocationUrl =
    event.google_maps_url ??
    event.venue?.google_maps_url ??
    event.venue?.url ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueLocationQuery || venueLocation)}`;

  const defaultItems =
    customData?.event?.eventChecklistItems && customData.event.eventChecklistItems.length > 0
      ? customData.event.eventChecklistItems
      : (DEFAULT_CHECKLIST_ITEMS_BY_TYPE[key] ?? DEFAULT_ACCEPTED_CHECKLIST_ITEMS);

  const bevySessionTime = formatBevySessionTime(event.start_date, event.end_date);
  const bevyCheckinDeadline = formatBevyCheckinDeadline(event.start_date, 30);
  const overrideSessionTime = customData?.overrideSessionTime?.trim();
  const overrideCheckinDeadline = customData?.overrideCheckinDeadline?.trim();

  return {
    attendee: {
      name: customData?.attendee?.name ?? "Alex Pratama",
      email: customData?.attendee?.email ?? "alex.pratama@example.com",
    },
    event: {
      headerEmailUrl: defaultHeader,
      eventName: event.title || customData?.event?.eventName || "Cloud Community Day Jakarta 2026",
      eventCtaUrl: defaultCta,
      eventChecklistItems: [...defaultItems],
    },
    sessionTime:
      overrideSessionTime ||
      bevySessionTime ||
      event.default_session_time?.trim() ||
      undefined ||
      customData?.sessionTime ||
      "09:00 - 17:00 WIB",
    checkinDeadline:
      overrideCheckinDeadline ||
      bevyCheckinDeadline ||
      event.default_session_checkin_deadline?.trim() ||
      undefined ||
      customData?.checkinDeadline ||
      "10:30 WIB",
    overrideSessionTime: customData?.overrideSessionTime ?? "",
    overrideCheckinDeadline: customData?.overrideCheckinDeadline ?? "",
    venueLocation,
    venueLocationUrl,
    eventDate: event.start_date ? eventDate : (customData?.eventDate ?? eventDate),
    qrCode: customData?.qrCode ?? SAMPLE_QR_CODE_BASE64,
    attendeeCode: customData?.attendeeCode ?? "GDG-JKT-89241",
    attendeeId: customData?.attendeeId ?? "2793132",
    cancellationReason:
      customData?.cancellationReason ??
      (key === "cancelled" ? "Incomplete registration profile or duplicate submission." : undefined),
  };
}

export function getAllCleanDefaultTemplatesData(
  event: FirestoreEvent,
): Record<EmailTemplateKey, TemplateSimulatedData> {
  return {
    interest: getCleanDefaultTemplateDataForType("interest", event),
    accepted: getCleanDefaultTemplateDataForType("accepted", event),
    waitlisted: getCleanDefaultTemplateDataForType("waitlisted", event),
    paid_waitlisted: getCleanDefaultTemplateDataForType("paid_waitlisted", event),
    rejected_waitlisted: getCleanDefaultTemplateDataForType("rejected_waitlisted", event),
    rejected_paid_waitlisted: getCleanDefaultTemplateDataForType("rejected_paid_waitlisted", event),
    rejected_hybrid: getCleanDefaultTemplateDataForType("rejected_hybrid", event),
    rejected_non_hybrid: getCleanDefaultTemplateDataForType("rejected_non_hybrid", event),
    rejected_virtual: getCleanDefaultTemplateDataForType("rejected_virtual", event),
    cancelled: getCleanDefaultTemplateDataForType("cancelled", event),
    cancelled_attendee: getCleanDefaultTemplateDataForType("cancelled_attendee", event),
  };
}

export function getDefaultTemplateDataForType(key: EmailTemplateKey, event: FirestoreEvent): TemplateSimulatedData {
  const cleanDefaults = getCleanDefaultTemplateDataForType(key, event);
  const savedByType = event.email_templates?.templates_data?.[key];
  const legacySaved = key === "accepted" ? event.email_templates?.template_data : undefined;
  let savedData = savedByType ?? legacySaved;

  // Guard against contaminated checklist items if ticket items were previously saved into interest or rejected templates
  if (
    key !== "accepted" &&
    savedData?.eventChecklistItems &&
    savedData.eventChecklistItems.some(
      (item) => item.includes("First-Come") || item.includes("Laptop") || item.includes("QR code"),
    )
  ) {
    savedData = {
      ...savedData,
      eventChecklistItems: undefined,
    };
  }

  if (!savedData) {
    return cleanDefaults;
  }

  const bevySessionTime = formatBevySessionTime(event.start_date, event.end_date);
  const bevyCheckinDeadline = formatBevyCheckinDeadline(event.start_date, 30);
  const hasBevyVenue = Boolean(event.venue?.name || event.venue?.address || event.venue?.city);

  const overrideSessionTime = savedData.overrideSessionTime?.trim();
  const overrideCheckinDeadline = savedData.overrideCheckinDeadline?.trim();

  const resolvedSessionTime =
    overrideSessionTime ||
    bevySessionTime ||
    event.default_session_time?.trim() ||
    undefined ||
    savedData.sessionTime ||
    cleanDefaults.sessionTime;

  const resolvedCheckinDeadline =
    overrideCheckinDeadline ||
    bevyCheckinDeadline ||
    event.default_session_checkin_deadline?.trim() ||
    undefined ||
    savedData.checkinDeadline ||
    cleanDefaults.checkinDeadline;

  const resolvedEventDate = event.start_date
    ? cleanDefaults.eventDate
    : (savedData.eventDate ?? cleanDefaults.eventDate);

  const resolvedVenueLocation = hasBevyVenue
    ? cleanDefaults.venueLocation
    : (savedData.venueLocation ?? cleanDefaults.venueLocation);

  const resolvedVenueLocationUrl =
    event.google_maps_url || event.venue?.google_maps_url || event.venue?.url || hasBevyVenue
      ? cleanDefaults.venueLocationUrl
      : (savedData.venueLocationUrl ?? cleanDefaults.venueLocationUrl);

  return {
    attendee: {
      name: savedData.attendeeName ?? cleanDefaults.attendee.name,
      email: savedData.attendeeEmail ?? cleanDefaults.attendee.email,
    },
    event: {
      headerEmailUrl: savedData.headerEmailUrl ?? cleanDefaults.event.headerEmailUrl,
      eventName: event.title || savedData.eventName || cleanDefaults.event.eventName,
      eventCtaUrl: savedData.eventCtaUrl ?? cleanDefaults.event.eventCtaUrl,
      eventChecklistItems:
        savedData.eventChecklistItems && savedData.eventChecklistItems.length > 0
          ? savedData.eventChecklistItems
          : cleanDefaults.event.eventChecklistItems,
    },
    sessionTime: resolvedSessionTime,
    checkinDeadline: resolvedCheckinDeadline,
    overrideSessionTime: savedData.overrideSessionTime ?? "",
    overrideCheckinDeadline: savedData.overrideCheckinDeadline ?? "",
    venueLocation: resolvedVenueLocation,
    venueLocationUrl: resolvedVenueLocationUrl,
    eventDate: resolvedEventDate,
    qrCode: savedData.qrCode ?? cleanDefaults.qrCode,
    attendeeCode: savedData.attendeeCode ?? cleanDefaults.attendeeCode,
    attendeeId: savedData.attendeeId ?? cleanDefaults.attendeeId,
    cancellationReason: savedData.cancellationReason ?? cleanDefaults.cancellationReason,
  };
}

export function getAllDefaultTemplatesData(event: FirestoreEvent): Record<EmailTemplateKey, TemplateSimulatedData> {
  return {
    interest: getDefaultTemplateDataForType("interest", event),
    accepted: getDefaultTemplateDataForType("accepted", event),
    waitlisted: getDefaultTemplateDataForType("waitlisted", event),
    paid_waitlisted: getDefaultTemplateDataForType("paid_waitlisted", event),
    rejected_waitlisted: getDefaultTemplateDataForType("rejected_waitlisted", event),
    rejected_paid_waitlisted: getDefaultTemplateDataForType("rejected_paid_waitlisted", event),
    rejected_hybrid: getDefaultTemplateDataForType("rejected_hybrid", event),
    rejected_non_hybrid: getDefaultTemplateDataForType("rejected_non_hybrid", event),
    rejected_virtual: getDefaultTemplateDataForType("rejected_virtual", event),
    cancelled: getDefaultTemplateDataForType("cancelled", event),
    cancelled_attendee: getDefaultTemplateDataForType("cancelled_attendee", event),
  };
}

export function getDefaultTemplateData(event: FirestoreEvent): TemplateSimulatedData {
  return getDefaultTemplateDataForType("accepted", event);
}

export function interpolateTemplateHtml(
  html: string,
  data: TemplateSimulatedData,
  options?: { preserveQrCodeTag?: boolean },
): string {
  let rendered = html;
  const { attendee, event } = data;

  // Checklist HTML block
  const checklistHtml = renderChecklistItemsHtml(event.eventChecklistItems);

  // Check if template contains explicit placeholder tag
  const hasTag =
    rendered.includes("{{ $('event-params').item.json.eventChecklistItems }}") ||
    rendered.includes("{ $('event-params').item.json.eventChecklistItems }") ||
    rendered.includes("{{ $('event-params').item.json.eventChecklistItems }}") ||
    rendered.includes("{ $('event-params').item.json.eventChecklistItems }") ||
    rendered.includes("{{ eventChecklistItems }}") ||
    rendered.includes("{{ eventChecklistItems }}");

  if (hasTag) {
    rendered = rendered.replaceAll("{{ $('event-params').item.json.eventChecklistItems }}", checklistHtml);
    rendered = rendered.replaceAll("{ $('event-params').item.json.eventChecklistItems }", checklistHtml);
    rendered = rendered.replaceAll("{{ $('event-params').item.json.eventChecklistItems }}", checklistHtml);
    rendered = rendered.replaceAll("{ $('event-params').item.json.eventChecklistItems }", checklistHtml);
    rendered = rendered.replaceAll("{{ eventChecklistItems }}", checklistHtml);
    rendered = rendered.replaceAll("{{ eventChecklistItems }}", checklistHtml);
  } else if (rendered.includes('<div class="checklist-box">') && checklistHtml) {
    // If template has static checklist box, replace whole box inner content without duplicating
    rendered = replaceChecklistBoxContent(rendered, checklistHtml);
  } else if (checklistHtml && rendered.includes('<div class="note-box">')) {
    // Replace old static disclaimer note-box in older interest templates with the dynamic checklist box
    rendered = rendered.replace(
      /(?:<!-- Disclaimer Box -->\s*)?<div class="note-box">[\s\S]*?<\/div>/i,
      `<div class="checklist-box">\n            <h3 style="margin-top: 0; color: #4285f4;">📝 Important Registration Notes</h3>\n${checklistHtml}\n          </div>`,
    );
  } else if (checklistHtml && rendered.includes('<div class="step-box">')) {
    // Fallback for older interest templates: inject checklist-box cleanly right after step-box
    const stepBoxMatch = /<\/div>(\s*<p style="text-align: center;)/i.exec(rendered);
    if (stepBoxMatch && stepBoxMatch.index !== undefined) {
      const fallbackBox = `\n\n          <!-- Registration Checklist -->\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #4285f4;">📝 Important Registration Notes</h3>\n${checklistHtml}\n          </div>`;
      rendered = `${rendered.slice(0, stepBoxMatch.index)}</div>${fallbackBox}\n\n          ${rendered.slice(stepBoxMatch.index + 6)}`;
    }
  }

  // Remove redundant static note-box if template already has checklist-box rendered
  if (rendered.includes('<div class="checklist-box">') && rendered.includes('<div class="note-box">')) {
    rendered = rendered.replace(/(?:<!-- Disclaimer Box -->\s*)?<div class="note-box">[\s\S]*?<\/div>/i, "");
  }

  // Event Name
  const eventName = event.eventName;
  rendered = rendered.replaceAll("{{ $('event-params').item.json.eventName }}", eventName);
  rendered = rendered.replaceAll("{ $('event-params').item.json.eventName }", eventName);
  rendered = rendered.replaceAll("{{ $('bevy-config').item.json.bevyEventName }}", eventName);
  rendered = rendered.replaceAll("{ $('bevy-config').item.json.bevyEventName }", eventName);
  rendered = rendered.replaceAll("{{ $('email-config').item.json.eventName }}", eventName);
  rendered = rendered.replaceAll("{ $('email-config').item.json.eventName }", eventName);
  rendered = rendered.replaceAll("{{ eventName }}", eventName);

  // Header Image URL
  const headerUrl = event.headerEmailUrl;
  rendered = rendered.replaceAll("{{ $('event-params').item.json.headerEmailUrl }}", headerUrl);
  rendered = rendered.replaceAll("{ $('event-params').item.json.headerEmailUrl }", headerUrl);
  rendered = rendered.replaceAll("{{ $('event-params').item.json.eventHeaderUrl }}", headerUrl);
  rendered = rendered.replaceAll("{ $('event-params').item.json.eventHeaderUrl }", headerUrl);
  rendered = rendered.replaceAll("{{ $('bevy-config').item.json.bevyEventHeaderEmailUrl }}", headerUrl);
  rendered = rendered.replaceAll("{ $('bevy-config').item.json.bevyEventHeaderEmailUrl }", headerUrl);
  rendered = rendered.replaceAll("{{ $('email-config').item.json.eventHeaderEmailUrl }}", headerUrl);
  rendered = rendered.replaceAll("{ $('email-config').item.json.eventHeaderEmailUrl }", headerUrl);
  rendered = rendered.replaceAll("{{ headerEmailUrl }}", headerUrl);

  // Event Action / CTA URL
  const ctaUrl = event.eventCtaUrl;
  rendered = rendered.replaceAll("{{ $('event-params').item.json.eventCtaUrl }}", ctaUrl);
  rendered = rendered.replaceAll("{ $('event-params').item.json.eventCtaUrl }", ctaUrl);
  rendered = rendered.replaceAll("{{ $('event-params').item.json.eventActionUrl }}", ctaUrl);
  rendered = rendered.replaceAll("{ $('event-params').item.json.eventActionUrl }", ctaUrl);
  rendered = rendered.replaceAll("{{ $('email-config').item.json.actionButtonUrl }}", ctaUrl);
  rendered = rendered.replaceAll("{ $('email-config').item.json.actionButtonUrl }", ctaUrl);
  rendered = rendered.replaceAll("{{ eventCtaUrl }}", ctaUrl);

  // Attendee Name
  const attendeeName = attendee.name;
  rendered = rendered.replaceAll("{{ $('loop-send-email').item.json['Full Name'] }}", attendeeName);
  rendered = rendered.replaceAll("{ $('loop-send-email').item.json['Full Name'] }", attendeeName);
  rendered = rendered.replaceAll("{{ $('loop-send-rejected-email').item.json['Full Name'] }}", attendeeName);
  rendered = rendered.replaceAll("{ $('loop-send-rejected-email').item.json['Full Name'] }", attendeeName);
  rendered = rendered.replaceAll("{{ $('bevy-config').item.json.bevyUserName }}", attendeeName);
  rendered = rendered.replaceAll("{ $('bevy-config').item.json.bevyUserName }", attendeeName);
  rendered = rendered.replaceAll("{{ $('attendee-data').item.json.name }}", attendeeName);
  rendered = rendered.replaceAll("{ $('attendee-data').item.json.name }", attendeeName);
  rendered = rendered.replaceAll("{{ name }}", attendeeName);

  // Attendee Email
  const attendeeEmail = attendee.email;
  rendered = rendered.replaceAll("{{ $('loop-send-email').item.json['Email'] }}", attendeeEmail);
  rendered = rendered.replaceAll("{ $('loop-send-email').item.json['Email'] }", attendeeEmail);
  rendered = rendered.replaceAll("{{ $('bevy-config').item.json.bevyUserEmail }}", attendeeEmail);
  rendered = rendered.replaceAll("{ $('bevy-config').item.json.bevyUserEmail }", attendeeEmail);
  rendered = rendered.replaceAll("{{ $('attendee-data').item.json.email }}", attendeeEmail);
  rendered = rendered.replaceAll("{ $('attendee-data').item.json.email }", attendeeEmail);
  rendered = rendered.replaceAll("{{ email }}", attendeeEmail);

  // Date, Session, Location, QR
  const eventDate = data.eventDate ?? "Saturday, 25 October 2026";
  rendered = rendered.replaceAll("{{ $('bevy-config').item.json.bevyEventDate }}", eventDate);
  rendered = rendered.replaceAll("{ $('bevy-config').item.json.bevyEventDate }", eventDate);

  // Backwards-compatibility: Ensure checkin deadline row is in details-box if template omitted it
  if (
    rendered.includes("details-box") &&
    !rendered.includes("bevyCheckinDeadline") &&
    !rendered.includes("Check-in Deadline")
  ) {
    rendered = ensureCheckinDeadlineInAcceptedHtml(rendered);
  }

  // Backwards-compatibility: Ensure cancellation reason is in alert-box if template omitted it
  if (
    (data.cancellationReason || rendered.includes("cancelled by the organizer")) &&
    rendered.includes("alert-box") &&
    !rendered.includes("cancellationReason") &&
    !rendered.includes("cancellation_reason") &&
    !rendered.includes("Reason for Cancellation:")
  ) {
    rendered = ensureCancellationReasonInCancelledHtml(rendered);
  }

  const sessionTime =
    data.overrideSessionTime && data.overrideSessionTime.trim() !== ""
      ? data.overrideSessionTime.trim()
      : (data.sessionTime ?? "09:00 - 17:00 WIB");
  rendered = rendered.replaceAll("{{ $('session-config').item.json.bevySessionTime }}", sessionTime);
  rendered = rendered.replaceAll("{ $('session-config').item.json.bevySessionTime }", sessionTime);

  const checkinDeadline =
    data.overrideCheckinDeadline && data.overrideCheckinDeadline.trim() !== ""
      ? data.overrideCheckinDeadline.trim()
      : (data.checkinDeadline ?? "10:30 WIB");
  rendered = rendered.replaceAll("{{ $('session-config').item.json.bevyCheckinDeadline }}", checkinDeadline);
  rendered = rendered.replaceAll("{ $('session-config').item.json.bevyCheckinDeadline }", checkinDeadline);
  rendered = rendered.replaceAll("{{ checkinDeadline }}", checkinDeadline);
  rendered = rendered.replaceAll("{{ bevyCheckinDeadline }}", checkinDeadline);

  const venueLoc = data.venueLocation ?? "Google Indonesia, Pacific Century Place Level 45, SCBD";
  rendered = rendered.replaceAll("{{ $('bevy-config').item.json.bevyEventLocation }}", venueLoc);
  rendered = rendered.replaceAll("{ $('bevy-config').item.json.bevyEventLocation }", venueLoc);

  const venueLocUrl =
    data.venueLocationUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueLoc)}`;
  rendered = rendered.replaceAll("{{ $('bevy-config').item.json.bevyEventLocationUrl }}", venueLocUrl);
  rendered = rendered.replaceAll("{ $('bevy-config').item.json.bevyEventLocationUrl }", venueLocUrl);

  if (options?.preserveQrCodeTag) {
    // Preserve dynamic n8n tags for approved attendee webhook dispatch
    rendered = adjustBodyEmailForApprovedWebhook(rendered);
  } else {
    // Preview mode: replace with visual sample QR code and reference data
    const qrCode = data.qrCode ?? SAMPLE_QR_CODE_BASE64;
    rendered = rendered.replaceAll("{{ $('Generate QR Code').item.json.qrCode }}", qrCode);
    rendered = rendered.replaceAll("{ $('Generate QR Code').item.json.qrCode }", qrCode);
    rendered = rendered.replaceAll("{{ $('generate-qrcode').item.json.qrCode }}", qrCode);
    rendered = rendered.replaceAll("{ $('generate-qrcode').item.json.qrCode }", qrCode);

    const attendeeCode = data.attendeeCode ?? "GDG-JKT-89241";
    const attendeeId = String(data.attendeeId ?? "2793132");
    rendered = rendered.replaceAll("{{ $('add-bevy-attendee-api').item.json.attendee_code }}", attendeeCode);
    rendered = rendered.replaceAll("{ $('add-bevy-attendee-api').item.json.attendee_code }", attendeeCode);
    rendered = rendered.replaceAll("{{ $('Add Bevy Attendee API').item.json.attendee_code }}", attendeeCode);
    rendered = rendered.replaceAll("{ $('Add Bevy Attendee API').item.json.attendee_code }", attendeeCode);

    rendered = rendered.replaceAll("{{ $('add-bevy-attendee-api').item.json.id }}", attendeeId);
    rendered = rendered.replaceAll("{ $('add-bevy-attendee-api').item.json.id }", attendeeId);
    rendered = rendered.replaceAll("{{ $('Add Bevy Attendee API').item.json.id }}", attendeeId);
    rendered = rendered.replaceAll("{ $('Add Bevy Attendee API').item.json.id }", attendeeId);
    rendered = rendered.replaceAll("{{ attendeeId }}", attendeeId);
    rendered = rendered.replaceAll("{{ AttendeeId }}", attendeeId);
  }

  // Cancellation Reason variables
  const rawReason = data.cancellationReason || "Incomplete registration profile or duplicate submission.";
  const formattedReason = rawReason.replace(/\n/g, "<br>");
  rendered = rendered.replaceAll("{{ $('event-params').item.json.cancellationReason }}", formattedReason);
  rendered = rendered.replaceAll("{ $('event-params').item.json.cancellationReason }", formattedReason);
  rendered = rendered.replaceAll("{{ cancellation_reason }}", formattedReason);
  rendered = rendered.replaceAll("{ cancellation_reason }", formattedReason);
  rendered = rendered.replaceAll("{{ cancellationReason }}", formattedReason);
  rendered = rendered.replaceAll("{ cancellationReason }", formattedReason);
  rendered = rendered.replaceAll("[[CancellationReason]]", formattedReason);

  // Paid Waitlist variables
  rendered = rendered.replaceAll("{{ invoice_number }}", data.invoiceNumber ?? "INV-1792031921352-132640");
  rendered = rendered.replaceAll("{{ paid_amount }}", data.paidAmount ?? "Rp 100.500");
  rendered = rendered.replaceAll(
    "{{ session_name }}",
    data.sessionName ?? (data.sessionTime ? "Super Early Bird" : "General Track"),
  );

  if (rendered.includes("details-box") || rendered.includes("ticket-card")) {
    rendered = ensureVenueButtonAndFooterInHtml(rendered);
  }

  return rendered;
}

/**
 * Adjusts body HTML for the approved attendee webhook request so the QR Code
 * and Attendee Ref Code can be replaced dynamically by n8n workflow nodes.
 */
export function adjustBodyEmailForApprovedWebhook(html: string): string {
  let adjusted = html;

  // 1. Replace hardcoded SAMPLE_QR_CODE_BASE64 with the n8n Generate QR Code expression
  adjusted = adjusted.replaceAll(SAMPLE_QR_CODE_BASE64, "{{ $('Generate QR Code').item.json.qrCode }}");

  // 2. Ensure any img with qr-img class has the n8n Generate QR Code expression regardless of attribute order
  adjusted = adjusted.replace(
    /(<img\b(?=[^>]*\bclass=["'][^"']*\bqr-img\b[^"']*["'])[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi,
    (_match, prefix, _src, suffix) => {
      return `${prefix}data:image/png;base64,{{ $('Generate QR Code').item.json.qrCode }}${suffix}`;
    },
  );

  // 3. Update legacy QR code and attendee reference code tags to the matching dynamic n8n expressions
  adjusted = adjusted.replaceAll(
    "{{ $('generate-qrcode').item.json.qrCode }}",
    "{{ $('Generate QR Code').item.json.qrCode }}",
  );
  adjusted = adjusted.replaceAll(
    "{ $('generate-qrcode').item.json.qrCode }",
    "{{ $('Generate QR Code').item.json.qrCode }}",
  );
  adjusted = adjusted.replaceAll(
    "{{ $('add-bevy-attendee-api').item.json.attendee_code }}",
    "{{ $('Add Bevy Attendee API').item.json.attendee_code }}",
  );
  adjusted = adjusted.replaceAll(
    "{ $('add-bevy-attendee-api').item.json.attendee_code }",
    "{{ $('Add Bevy Attendee API').item.json.attendee_code }}",
  );
  adjusted = adjusted.replaceAll(
    "{{ $('add-bevy-attendee-api').item.json.id }}",
    "{{ $('Add Bevy Attendee API').item.json.id }}",
  );
  adjusted = adjusted.replaceAll(
    "{ $('add-bevy-attendee-api').item.json.id }",
    "{{ $('Add Bevy Attendee API').item.json.id }}",
  );
  adjusted = adjusted.replaceAll(
    "{ $('Add Bevy Attendee API').item.json.id }",
    "{{ $('Add Bevy Attendee API').item.json.id }}",
  );

  // 4. Replace any hardcoded default sample attendee ref code with the dynamic expression
  adjusted = adjusted.replaceAll("GDG-JKT-89241", "{{ $('Add Bevy Attendee API').item.json.attendee_code }}");

  // 5. Ensure any div with attendee-id class uses dynamic attendee_code (Ref) and id (ID)
  adjusted = adjusted.replace(
    /(<div\b(?=[^>]*\bclass=["'][^"']*\battendee-id\b[^"']*["'])[^>]*>)([\s\S]*?)(<\/div>)/gi,
    (_match, prefix, content, suffix) => {
      let updated = content;
      if (!updated.includes("{{ $('Add Bevy Attendee API').item.json.attendee_code }}")) {
        updated = `<div>Ref: {{ $('Add Bevy Attendee API').item.json.attendee_code }}</div>`;
      }
      if (!updated.includes("{{ $('Add Bevy Attendee API').item.json.id }}")) {
        const trimmed = updated.trim();
        if (trimmed.includes("<div>")) {
          updated = `${trimmed}\n              <div style="margin-top: 2px;">ID: {{ $('Add Bevy Attendee API').item.json.id }}</div>`;
        } else {
          updated = `<div>${trimmed}</div>\n              <div style="margin-top: 2px;">ID: {{ $('Add Bevy Attendee API').item.json.id }}</div>`;
        }
      }
      return `${prefix}\n              ${updated.trim()}\n            ${suffix}`;
    },
  );

  // 6. Ensure "See you at the venue! 🚀" is rendered as a robust inline-styled button and footer is styled
  adjusted = ensureVenueButtonAndFooterInHtml(adjusted);

  return adjusted;
}

export function interpolateTemplateSubject(subject: string, data: TemplateSimulatedData): string {
  let rendered = subject;
  const { attendee, event } = data;

  rendered = rendered.replaceAll("{{ $('event-params').item.json.eventName }}", event.eventName);
  rendered = rendered.replaceAll("{ $('event-params').item.json.eventName }", event.eventName);
  rendered = rendered.replaceAll("{{ $('bevy-config').item.json.bevyEventName }}", event.eventName);
  rendered = rendered.replaceAll("{ $('bevy-config').item.json.bevyEventName }", event.eventName);
  rendered = rendered.replaceAll("{{ $('email-config').item.json.eventName }}", event.eventName);
  rendered = rendered.replaceAll("{ $('email-config').item.json.eventName }", event.eventName);
  rendered = rendered.replaceAll("{{ eventName }}", event.eventName);

  rendered = rendered.replaceAll("{{ $('loop-send-email').item.json['Full Name'] }}", attendee.name);
  rendered = rendered.replaceAll("{ $('loop-send-email').item.json['Full Name'] }", attendee.name);
  rendered = rendered.replaceAll("{{ $('bevy-config').item.json.bevyUserName }}", attendee.name);
  rendered = rendered.replaceAll("{ $('bevy-config').item.json.bevyUserName }", attendee.name);
  rendered = rendered.replaceAll("{{ name }}", attendee.name);

  return rendered;
}

export function interpolateTemplatePreview(
  html: string,
  event: FirestoreEvent,
  options?: {
    templateKey?: EmailTemplateKey;
    sampleName?: string;
    sampleEmail?: string;
    simulatedData?: TemplateSimulatedData;
  },
): string {
  if (options?.simulatedData) {
    return interpolateTemplateHtml(html, options.simulatedData);
  }

  const defaultData = options?.templateKey
    ? getDefaultTemplateDataForType(options.templateKey, event)
    : getDefaultTemplateData(event);

  if (options?.sampleName) {
    defaultData.attendee.name = options.sampleName;
  }
  if (options?.sampleEmail) {
    defaultData.attendee.email = options.sampleEmail;
  }

  return interpolateTemplateHtml(html, defaultData);
}

/**
 * Validates the event type and determines which rejected email template to use:
 * - "Hybrid" -> "rejected_hybrid"
 * - "In-Person" -> "rejected_non_hybrid"
 * - "Virtual" -> "rejected_virtual"
 */
export function resolveRejectedTemplateKeyForEvent(
  event: Partial<FirestoreEvent>,
): "rejected_hybrid" | "rejected_non_hybrid" | "rejected_virtual" {
  const titleType = (event.event_type_title ?? "").toLowerCase();
  if (titleType.includes("hybrid")) return "rejected_hybrid";
  if (titleType.includes("virtual") || titleType.includes("online")) return "rejected_virtual";
  if (
    titleType.includes("in-person") ||
    titleType.includes("in person") ||
    titleType.includes("physical") ||
    titleType.includes("onsite") ||
    titleType.includes("on-site")
  ) {
    return "rejected_non_hybrid";
  }

  const { isHybrid, isVirtual } = resolveEventAudience(event.audience_type, event.is_virtual);
  if (isHybrid) return "rejected_hybrid";
  if (isVirtual) return "rejected_virtual";
  return "rejected_non_hybrid";
}

/**
 * Renders subject and body HTML for a given attendee, event, and template key.
 * Guarantees non-empty firstName and lastName for strict n8n payload validation.
 */
export function buildRenderedEmailForAttendee({
  templateKey,
  attendee,
  event,
  invoiceNumber,
  paidAmount,
  sessionName,
  cancellationReason,
}: {
  templateKey: EmailTemplateKey;
  attendee: { name: string; email: string };
  event: Partial<FirestoreEvent> | Record<string, unknown>;
  invoiceNumber?: string;
  paidAmount?: string;
  sessionName?: string;
  cancellationReason?: string;
}): {
  firstName: string;
  lastName: string;
  subjectEmail: string;
  bodyEmail: string;
} {
  const { firstName, lastName } = splitFullName(attendee.name);
  const safeFirstName = firstName || "Attendee";
  const safeLastName = lastName || firstName || "-";

  const eventRecord = event as Partial<FirestoreEvent>;
  const fullEvent: FirestoreEvent = {
    id: eventRecord.id ?? "event",
    title: eventRecord.title ?? "GDG Jakarta Event",
    status: (eventRecord.status as FirestoreEvent["status"]) ?? "Published",
    start_date: eventRecord.start_date ?? "",
    end_date: eventRecord.end_date ?? "",
    requires_approval: eventRecord.requires_approval ?? false,
    total_registrations: eventRecord.total_registrations ?? 0,
    total_approved: eventRecord.total_approved ?? 0,
    total_checked_in: eventRecord.total_checked_in ?? 0,
    banner_url: eventRecord.banner_url,
    picture_url: eventRecord.picture_url,
    email_templates: eventRecord.email_templates,
    created_at: eventRecord.created_at ?? "",
    updated_at: eventRecord.updated_at ?? "",
    audience_type: eventRecord.audience_type,
    is_virtual: eventRecord.is_virtual,
    event_type_title: eventRecord.event_type_title,
    venue: eventRecord.venue,
    url: eventRecord.url,
    static_url: eventRecord.static_url,
  };

  const simulatedData = getDefaultTemplateDataForType(templateKey, fullEvent);
  simulatedData.attendee = {
    name: attendee.name || "Attendee",
    email: attendee.email,
  };
  simulatedData.event.eventName = fullEvent.title;
  const eventBanner = fullEvent.banner_url ?? fullEvent.picture_url;
  if (eventBanner) {
    simulatedData.event.headerEmailUrl = eventBanner;
  }
  if (invoiceNumber) simulatedData.invoiceNumber = invoiceNumber;
  if (paidAmount) simulatedData.paidAmount = paidAmount;
  if (sessionName) simulatedData.sessionName = sessionName;
  if (cancellationReason) simulatedData.cancellationReason = cancellationReason;

  // Get raw template HTML
  const rawHtml =
    (fullEvent.email_templates as Record<string, string | undefined> | undefined)?.[templateKey] ??
    getDefaultTemplateByKey(templateKey);

  // Get raw template subject
  const meta = EMAIL_TEMPLATES_CONFIG.find((m) => m.key === templateKey);
  const subjectKey = `${templateKey}_subject`;
  const rawSubject =
    (fullEvent.email_templates as Record<string, string | undefined> | undefined)?.[subjectKey] ??
    meta?.subjectDefault ??
    `Update regarding: ${fullEvent.title}`;

  const bodyEmail = interpolateTemplateHtml(rawHtml, simulatedData);
  const subjectEmail = interpolateTemplateSubject(rawSubject, simulatedData);

  return {
    firstName: safeFirstName,
    lastName: safeLastName,
    subjectEmail,
    bodyEmail,
  };
}

/**
 * Resolves the webhook URL for send-email (reusable across interest, rejected hybrid/in-person/virtual).
 */
export function resolveSendEmailWebhookUrl(customBaseUrl?: string): string {
  const defaultFallback = "https://n8n.gdgjakarta.com/webhook/api/send-email";
  const safeCustom = customBaseUrl ? assertSafeWebhookUrl(customBaseUrl, "") : "";

  let target = "";
  if (process.env.N8N_SEND_EMAIL_WEBHOOK_URL) {
    target = process.env.N8N_SEND_EMAIL_WEBHOOK_URL.trim();
  } else if (process.env.N8N_SEND_INTEREST_EMAIL_WEBHOOK_URL) {
    const custom = process.env.N8N_SEND_INTEREST_EMAIL_WEBHOOK_URL.trim();
    if (custom.endsWith("/send-interest-email")) {
      target = custom.replace(/\/send-interest-email$/, "/send-email");
    } else {
      target = custom;
    }
  } else {
    const base = (safeCustom || process.env.N8N_WEBHOOK_BASE_URL || "https://n8n.gdgjakarta.com/webhook/api")
      .trim()
      .replace(/\/+$/, "");

    if (base.endsWith("/send-email")) {
      target = base;
    } else if (base.endsWith("/send-interest-email")) {
      target = base.replace(/\/send-interest-email$/, "/send-email");
    } else if (base.endsWith("/webhook/api")) {
      target = `${base}/send-email`;
    } else if (base.endsWith("/webhook")) {
      target = `${base}/api/send-email`;
    } else if (base.endsWith("/api")) {
      target = `${base.slice(0, -4)}/webhook/api/send-email`;
    } else {
      target = `${base}/webhook/api/send-email`;
    }
  }
  return assertSafeWebhookUrl(target, defaultFallback);
}

/**
 * Resolves the webhook URL for send-interest-email (legacy alias pointing to updated send-email).
 */
export function resolveSendInterestEmailWebhookUrl(customBaseUrl?: string): string {
  return resolveSendEmailWebhookUrl(customBaseUrl);
}
