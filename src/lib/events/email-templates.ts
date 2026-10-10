import type { FirestoreEvent } from "@/lib/firestore/types";

export const SAMPLE_QR_CODE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAMgAAADIAQMAAACXljzdAAAABlBMVEX///8AAABVwtN+AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAA/UlEQVRYheWYwRGEIAxFv+OBoyVQypbmlkYplODRgyMmP+C4O9hAyIWBlwsh+YkCr7YWs4xwAp8c6v70R5JdOC87UBLCwX3wSKLcWAhjIEfHJPttTHJHxz0B9CiPSVotqINUfadKnJCmb8s+lb7yuScPYx6gZy6IxYCLdrOyz5obKgHeiDww5gLELdSM11CUsUh9dOlmckCx+814RyTafalviDafMQ/GIcyDOqlqRzfCwnBGmi18fnFT7y2MRNaa+89u9qWrO5JsyW1Ku7+9/JFY6kyuMbBuRiUfkoAScJtrIvrG2h6O2GJ5IKaCn/7+RvggT31jDLrK55q82gUvTG0vlaj95wAAAABJRU5ErkJggg==";

export const DEFAULT_INTEREST_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Registration Received: {{ $(\'event-params\').item.json.eventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 0 0 30px 0; /* Padding only at bottom for full-width header */\n        border-radius: 8px;\n        overflow: hidden; /* Clips the image to the border radius */\n      }\n      \n      .content {\n        padding: 0 30px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        display: block; /* Removes bottom spacing */\n        border-radius: 8px 8px 0 0;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      .btn {\n        display: block;\n        background-color: #4285f4;\n        color: #fff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 20px;\n        text-decoration: none;\n        width: 70%;\n        margin: 25px auto;\n        font-weight: 600;\n        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);\n        transition: background-color 0.3s;\n      }\n\n      .btn:hover {\n        background-color: #3367d6;\n      }\n\n      .step-box {\n        background-color: #f8f9fa;\n        padding: 20px;\n        border-radius: 8px;\n        margin: 20px 0;\n        border: 1px solid #e0e0e0;\n      }\n\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 20px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      .note-box {\n        background-color: #fce8e6;\n        border-left: 4px solid #ea4335;\n        padding: 15px;\n        margin-top: 20px;\n        color: #c5221f;\n        font-size: 0.95em;\n      }\n\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n      \n      p {\n          line-height: 1.6;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <!-- Header Image -->\n        <img src="{{ $(\'event-params\').item.json.eventHeaderUrl }}" onerror="this.src=\'https://placehold.co/600x300?text=Road+To+DevFest\'" alt="{{ $(\'event-params\').item.json.eventName }} Header" class="header-img" />\n      </div>\n      \n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'loop-send-email\').item.json[\'Full Name\'] }},</h2>\n        </div>\n        \n        <div class="start">\n          <p style="font-size: 1.1em;"><strong>We\u2019ve received your registration interest!</strong> \u2601\ufe0f</p>\n          \n          <p>Thank you for registering for <strong>{{ $(\'event-params\').item.json.eventName }}</strong>. We are thrilled by the overwhelming interest in this event.</p>\n\n          <!-- Registration Checklist -->\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #4285f4;">\ud83d\udcdd Important Registration Notes</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n          \n          <!-- Process Explanation -->\n          <div class="step-box">\n              <h3 style="margin-top: 0; color: #4285f4;">What Happens Next?</h3>\n              \n              <p><strong>1. Participant Curation</strong><br>\n              Our team will review all registrations to ensure a diverse and professional group of attendees. We aim to create the best environment for meaningful industry connections.</p>\n              \n              <p><strong>2. Outcome Notification</strong><br>\n              <span style="display:block; margin-top:5px;">\u2705 <strong>If selected:</strong> You will receive a separate follow-up email containing your <strong>Official Confirmation</strong> and an exclusive invitation to join our <strong>Google Chat Space</strong> to connect with other attendees.</span>\n              <span style="display:block; margin-top:5px;">\u274c <strong>If not selected:</strong> You will receive a notification email informing you that we are unable to provide a seat for you at this specific event.</span>\n              </p>\n          </div>\n\n          <p style="text-align: center; margin-top: 10px;">Please keep an eye on your inbox for our final update!</p>\n          \n          <a href="{{ $(\'event-params\').item.json.eventActionUrl }}" class="btn" target="_blank">View Event Details</a>\n\n          <p style="margin-top: 30px; font-size: 0.9em; color: #555;">Thank you for your understanding and for being part of our community. We hope to see you soon!</p>\n        </div>\n      </div>\n\n      <div class="center">\n        <div class="footer">\n          <img alt="GDG Cloud Jakarta" src="https://assets.gdgjakarta.org/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export const DEFAULT_ACCEPTED_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Your Official Ticket & Reminders: {{ $(\'bevy-config\').item.json.bevyEventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 30px;\n        border-radius: 8px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        border-radius: 8px 8px 0 0;\n        background-color: #4285f4;\n        min-height: 100px;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      /* Ticket Styles */\n      .ticket-card {\n        background-color: #f8f9fa;\n        border: 2px dashed #4285f4;\n        border-radius: 12px;\n        padding: 25px;\n        margin: 25px 0;\n        text-align: center;\n        position: relative;\n      }\n\n      .ticket-title {\n        color: #4285f4;\n        font-weight: 600;\n        margin-bottom: 5px;\n        text-transform: uppercase;\n        letter-spacing: 1px;\n        font-size: 0.9em;\n      }\n\n      .qr-placeholder {\n        background-color: #ffffff;\n        padding: 10px;\n        border-radius: 8px;\n        display: inline-block;\n        margin: 15px 0;\n        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);\n      }\n\n      .qr-img {\n        width: 200px;\n        height: 200px;\n        display: block;\n      }\n\n      .attendee-name {\n        font-size: 1.3em;\n        font-weight: 600;\n        color: #202124;\n        margin: 5px 0;\n      }\n\n      .attendee-id {\n        display: inline-block;\n        background-color: #e8f0fe;\n        color: #1967d2;\n        padding: 4px 12px;\n        border-radius: 4px;\n        font-family: \'Courier New\', monospace;\n        font-size: 14px;\n        font-weight: 600;\n        margin-bottom: 25px;\n      }\n\n      .details-box {\n        background-color: #ffffff;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 15px;\n        margin-top: 20px;\n        text-align: left;\n      }\n\n      .detail-row {\n        display: flex;\n        margin-bottom: 10px;\n      }\n\n      .detail-row:last-child {\n        margin-bottom: 0;\n      }\n\n      .detail-icon {\n        margin-right: 10px;\n        font-size: 1.1em;\n      }\n\n      /* Reminder Checklist Styles */\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 25px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      /* Button Styles */\n      .btn {\n        display: block;\n        background-color: #ea4335;\n        color: #ffffff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 24px;\n        text-decoration: none;\n        width: 70%;\n        margin: 20px auto;\n        font-weight: 600;\n        font-size: 15px;\n        box-shadow: 0 4px 6px rgba(0,0,0,0.1);\n      }\n      \n      .btn:hover {\n        background-color: #d93025;\n      }\n\n      /* Global Content Elements */\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n\n      .content {\n        padding: 0 15px;\n      }\n\n      p {\n        line-height: 1.6;\n      }\n\n      strong {\n        color: #202124;\n      }\n\n      a.location-link {\n        color: #1a73e8;\n        text-decoration: none;\n        font-weight: 600;\n      }\n\n      a.location-link:hover {\n        text-decoration: underline;\n      }\n\n      code {\n        background-color: #f1f3f4;\n        padding: 2px 6px;\n        border-radius: 4px;\n        font-family: \'Courier New\', Courier, monospace;\n        font-size: 0.9em;\n        color: #c5221f;\n        font-weight: 600;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <img src="{{ $(\'bevy-config\').item.json.bevyEventHeaderEmailUrl }}" onerror="this.src=\'https://placehold.co/600x300?text=Event+Header\'" alt="Event Header" class="header-img" />\n      </div>\n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'bevy-config\').item.json.bevyUserName }},</h2>\n        </div>\n        <div class="start">\n          <p>Your ticket is confirmed! \ud83c\udf9f\ufe0f</p>\n          <p>We are thrilled to welcome you to <strong>{{ $(\'bevy-config\').item.json.bevyEventName }}</strong>. Below is your official entrance ticket and important guidelines to ensure a smooth experience.</p>\n          \n          <div class="ticket-card">\n            <div class="ticket-title">Official Entry Pass</div>\n            <div class="qr-placeholder">\n              <img src="data:image/png;base64,{{ $(\'Generate QR Code\').item.json.qrCode }}" alt="Your Ticket QR Code" class="qr-img" />\n            </div>\n            <div class="attendee-name">{{ $(\'bevy-config\').item.json.bevyUserName }}</div>\n            <div class="attendee-id">Ref: {{ $(\'Add Bevy Attendee API\').item.json.id }}</div>\n            \n            <div class="details-box">\n              <div class="detail-row">\n                <span class="detail-icon">\ud83d\udcc5</span>\n                <div>\n                  <strong>Date</strong>\n                  <br>\n                  {{ $(\'bevy-config\').item.json.bevyEventDate }}\n                </div>\n              </div>\n              <div class="detail-row">\n                <span class="detail-icon">\u23f0</span>\n                <div>\n                  <strong>Time</strong>\n                  <br>\n                  {{ $(\'session-config\').item.json.bevySessionTime }}\n                </div>\n              </div>\n              <div class="detail-row">\n                <span class="detail-icon">\ud83d\udccd</span>\n                <div>\n                  <strong>Location</strong>\n                  <br>\n                  <a href="{{ $(\'bevy-config\').item.json.bevyEventLocationUrl }}" class="location-link" target="_blank">\n                    {{ $(\'bevy-config\').item.json.bevyEventLocation }}\n                  </a>\n                </div>\n              </div>\n            </div>\n          </div>\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #4285f4;">\ud83d\udcdd Attendee Checklist</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n          <p style="margin-top: 20px;">See you at the venue! \ud83d\ude80</p>\n        </div>\n      </div>\n      <div class="center">\n        <div class="footer">\n          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export const DEFAULT_REJECTED_HYBRID_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Update regarding: {{ $(\'email-config\').item.json.eventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 30px;\n        border-radius: 8px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        border-radius: 8px 8px 0 0;\n        background-color: #4285f4;\n        min-height: 100px;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      .btn {\n        display: block;\n        background-color: #4285f4;\n        color: #ffffff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 24px;\n        text-decoration: none;\n        width: 60%;\n        margin: 30px auto;\n        font-weight: 600;\n        font-size: 15px;\n        box-shadow: 0 4px 6px rgba(0,0,0,0.1);\n      }\n      \n      .btn:hover {\n        background-color: #3367d6;\n      }\n\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 20px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n\n      .content {\n        padding: 0 15px;\n      }\n\n      /* Fixed Info Box with Symmetrical Spacing adjusted to 16px */\n      .info-box {\n        background-color: #fce8e6;\n        border: 1px solid #ea4335;\n        border-radius: 8px;\n        padding: 16px; \n        margin: 24px 0;\n        color: #b31412;\n      }\n\n      .info-box p {\n        margin-top: 0; \n        margin-bottom: 16px; \n        line-height: 1.6;\n      }\n\n      .info-box p:last-child {\n        margin-bottom: 0; \n      }\n\n      p {\n        line-height: 1.6;\n        margin-bottom: 15px;\n      }\n\n      strong {\n        color: #202124;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <!-- Header Image -->\n        <img src="{{ $(\'email-config\').item.json.eventHeaderEmailUrl }}" onerror="this.src=\'https://placehold.co/600x300?text={{ $(\'email-config\').item.json.eventName }}\'" alt="Event Header" class="header-img" />\n      </div>\n      \n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'loop-send-rejected-email\').item.json[\'Full Name\'] }},</h2>\n        </div>\n        \n        <div class="start">\n          <p>Thank you for your interest in attending <strong>{{ $(\'email-config\').item.json.eventName }}</strong>.</p>\n          \n          <div class="info-box">\n            <p>\n              Due to overwhelming interest and strictly limited venue capacity, we are unfortunately unable to offer you a spot for this particular session.\n            </p>\n            <p>\n              Our selection process prioritizes applicants whose background, interests, and goals are most closely aligned with the focus and discussions planned for the event.\n            </p>\n          </div>\n\n          <!-- Alternatives Checklist -->\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #4285f4;">\ud83d\udccc Next Steps & Alternatives</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n\n          <p>We sincerely appreciate your interest in our event and hope to welcome you at future events and community initiatives.</p>\n          \n          <p>We encourage you to keep your professional profiles updated and stay connected for future technical workshops and community meetups.</p>\n\n          <a href="{{ $(\'email-config\').item.json.actionButtonUrl }}" class="btn">Follow Our Updates</a>\n\n          <p style="margin-top: 30px; font-size: 0.9em; color: #5f6368;">\n            Thank you for your understanding, and we hope to see you at another event soon!\n          </p>\n        </div>\n      </div>\n      \n      <div class="center">\n        <div class="footer">\n          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export const DEFAULT_REJECTED_NON_HYBRID_EMAIL_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Update regarding: {{ $(\'email-config\').item.json.eventName }}</title>\n    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />\n    <style>\n      body {\n        margin: 0;\n        padding: 0;\n        font-family: \'Poppins\', sans-serif;\n        background-color: #f1f3f4;\n        color: #3c4043;\n      }\n\n      .container {\n        max-width: 510px;\n        margin: 0 auto;\n        background-color: #ffffff;\n        padding: 30px;\n        border-radius: 8px;\n      }\n\n      .header-img {\n        width: 100%;\n        height: auto;\n        border-radius: 8px 8px 0 0;\n        background-color: #4285f4;\n        min-height: 100px;\n      }\n\n      .center {\n        text-align: center;\n      }\n\n      .start {\n        text-align: start;\n      }\n\n      .btn {\n        display: block;\n        background-color: #4285f4;\n        color: #ffffff !important;\n        text-align: center;\n        border-radius: 50px;\n        padding: 12px 24px;\n        text-decoration: none;\n        width: 60%;\n        margin: 30px auto;\n        font-weight: 600;\n        font-size: 15px;\n        box-shadow: 0 4px 6px rgba(0,0,0,0.1);\n      }\n      \n      .btn:hover {\n        background-color: #3367d6;\n      }\n\n      .checklist-box {\n        background-color: #f8f9fa;\n        border: 1px solid #e0e0e0;\n        border-radius: 8px;\n        padding: 20px;\n        margin: 20px 0;\n      }\n\n      .checklist-item {\n        margin-bottom: 15px;\n        display: flex;\n        align-items: flex-start;\n      }\n\n      .checklist-item:last-child {\n        margin-bottom: 0;\n      }\n\n      .icon {\n        margin-right: 12px;\n        font-size: 1.2em;\n        min-width: 25px;\n      }\n\n      .text {\n        font-size: 0.95em;\n        line-height: 1.5;\n      }\n\n      .footer {\n        margin-top: 24pt;\n        padding: 18pt;\n        background-color: #f8f9fa;\n        border-radius: 0 0 8px 8px;\n        text-align: center;\n      }\n\n      .content {\n        padding: 0 15px;\n      }\n\n      /* Fixed Info Box with Symmetrical Spacing adjusted to 16px */\n      .info-box {\n        background-color: #fce8e6;\n        border: 1px solid #ea4335;\n        border-radius: 8px;\n        padding: 16px; \n        margin: 24px 0;\n        color: #b31412;\n      }\n\n      .info-box p {\n        margin-top: 0; \n        margin-bottom: 16px; \n        line-height: 1.6;\n      }\n\n      .info-box p:last-child {\n        margin-bottom: 0; \n      }\n\n      p {\n        line-height: 1.6;\n        margin-bottom: 15px;\n      }\n\n      strong {\n        color: #202124;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="container">\n      <div class="center">\n        <!-- Header Image -->\n        <img src="{{ $(\'email-config\').item.json.eventHeaderEmailUrl }}" onerror="this.src=\'https://placehold.co/600x300?text=IWD+Jakarta+2026\'" alt="Event Header" class="header-img" />\n      </div>\n      \n      <div class="content">\n        <div class="start">\n          <h2>Hi {{ $(\'loop-send-rejected-email\').item.json[\'Full Name\'] }},</h2>\n        </div>\n        \n        <div class="start">\n          <p>Thank you for your interest in attending <strong>{{ $(\'email-config\').item.json.eventName }}</strong>.</p>\n          \n          <div class="info-box">\n            <p>\n              Due to overwhelming interest and strictly limited venue capacity, we are unfortunately unable to offer you a spot for this particular session.\n            </p>\n            <p>\n              Our selection process prioritizes applicants whose background, interests, and goals are most closely aligned with the focus and discussions planned for the event.\n            </p>\n          </div>\n\n          <!-- Important Notes Checklist -->\n          <div class="checklist-box">\n            <h3 style="margin-top: 0; color: #4285f4;">\ud83d\udccc Important Community Notes</h3>\n            {{ $(\'event-params\').item.json.eventChecklistItems }}\n          </div>\n\n          <p>We sincerely appreciate your interest in our event and hope to welcome you at future events and community initiatives.</p>\n          \n          <p>We encourage you to keep your professional profiles updated and stay connected for future technical workshops and community meetups.</p>\n\n          <a href="{{ $(\'email-config\').item.json.actionButtonUrl }}" class="btn">Follow Our Updates</a>\n\n          <p style="margin-top: 30px; font-size: 0.9em; color: #5f6368;">\n            Thank you for your understanding, and we hope to see you at another event soon!\n          </p>\n        </div>\n      </div>\n      \n      <div class="center">\n        <div class="footer">\n          <img alt="GDG Cloud Jakarta" src="https://assets.gdgjakarta.org/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />\n        </div>\n      </div>\n    </div>\n  </body>\n</html>';

export type EmailTemplateKey = "interest" | "accepted" | "rejected_hybrid" | "rejected_non_hybrid";

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
      sampleValue: "13:00 - 17:00 WIB",
    },
    {
      tag: "{{ $('session-config').item.json.bevyCheckinDeadline }}",
      label: "Check-in Deadline",
      description: "Latest arrival time before seat forfeiture",
      sampleValue: "13:30 WIB",
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
      tag: "{{ $('Add Bevy Attendee API').item.json.id }}",
      label: "Bevy Attendee ID",
      description: "Unique attendee ID from Add Bevy Attendee API node in n8n",
      sampleValue: "GDG-JKT-89241",
    },
    {
      tag: "{{ $('add-bevy-attendee-api').item.json.attendee_code }}",
      label: "Attendee Reference Code (Legacy)",
      description: "Unique attendee code from Bevy check-in API",
      sampleValue: "GDG-JKT-89241",
    },
  ],
  rejected_hybrid: [
    {
      tag: "{{ $('email-config').item.json.eventName }}",
      label: "Event Name",
      description: "Event name configured in n8n email-config node",
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
      description: "Event name configured in n8n email-config node",
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
  venueLocation?: string;
  venueLocationUrl?: string;
  eventDate?: string;
  qrCode?: string;
  attendeeCode?: string;
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

export const DEFAULT_CHECKLIST_ITEMS_BY_TYPE: Record<EmailTemplateKey, string[]> = {
  interest: DEFAULT_INTEREST_CHECKLIST_ITEMS,
  accepted: DEFAULT_ACCEPTED_CHECKLIST_ITEMS,
  rejected_hybrid: DEFAULT_REJECTED_HYBRID_CHECKLIST_ITEMS,
  rejected_non_hybrid: DEFAULT_REJECTED_NON_HYBRID_CHECKLIST_ITEMS,
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
  const venueLocationUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueLocation)}`;

  const defaultItems =
    customData?.event?.eventChecklistItems && customData.event.eventChecklistItems.length > 0
      ? customData.event.eventChecklistItems
      : (DEFAULT_CHECKLIST_ITEMS_BY_TYPE[key] ?? DEFAULT_ACCEPTED_CHECKLIST_ITEMS);

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
    sessionTime: customData?.sessionTime ?? "13:00 - 17:00 WIB",
    checkinDeadline: customData?.checkinDeadline ?? "13:30 WIB",
    venueLocation,
    venueLocationUrl,
    eventDate: customData?.eventDate ?? eventDate,
    qrCode: customData?.qrCode ?? SAMPLE_QR_CODE_BASE64,
    attendeeCode: customData?.attendeeCode ?? "GDG-JKT-89241",
  };
}

export function getAllCleanDefaultTemplatesData(
  event: FirestoreEvent,
): Record<EmailTemplateKey, TemplateSimulatedData> {
  return {
    interest: getCleanDefaultTemplateDataForType("interest", event),
    accepted: getCleanDefaultTemplateDataForType("accepted", event),
    rejected_hybrid: getCleanDefaultTemplateDataForType("rejected_hybrid", event),
    rejected_non_hybrid: getCleanDefaultTemplateDataForType("rejected_non_hybrid", event),
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

  return {
    attendee: {
      name: savedData.attendeeName ?? cleanDefaults.attendee.name,
      email: savedData.attendeeEmail ?? cleanDefaults.attendee.email,
    },
    event: {
      headerEmailUrl: savedData.headerEmailUrl ?? cleanDefaults.event.headerEmailUrl,
      eventName: savedData.eventName ?? cleanDefaults.event.eventName,
      eventCtaUrl: savedData.eventCtaUrl ?? cleanDefaults.event.eventCtaUrl,
      eventChecklistItems:
        savedData.eventChecklistItems && savedData.eventChecklistItems.length > 0
          ? savedData.eventChecklistItems
          : cleanDefaults.event.eventChecklistItems,
    },
    sessionTime: savedData.sessionTime ?? cleanDefaults.sessionTime,
    checkinDeadline: savedData.checkinDeadline ?? cleanDefaults.checkinDeadline,
    venueLocation: savedData.venueLocation ?? cleanDefaults.venueLocation,
    venueLocationUrl: savedData.venueLocationUrl ?? cleanDefaults.venueLocationUrl,
    eventDate: savedData.eventDate ?? cleanDefaults.eventDate,
    qrCode: savedData.qrCode ?? cleanDefaults.qrCode,
    attendeeCode: savedData.attendeeCode ?? cleanDefaults.attendeeCode,
  };
}

export function getAllDefaultTemplatesData(event: FirestoreEvent): Record<EmailTemplateKey, TemplateSimulatedData> {
  return {
    interest: getDefaultTemplateDataForType("interest", event),
    accepted: getDefaultTemplateDataForType("accepted", event),
    rejected_hybrid: getDefaultTemplateDataForType("rejected_hybrid", event),
    rejected_non_hybrid: getDefaultTemplateDataForType("rejected_non_hybrid", event),
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

  const sessionTime = data.sessionTime ?? "13:00 - 17:00 WIB";
  rendered = rendered.replaceAll("{{ $('session-config').item.json.bevySessionTime }}", sessionTime);
  rendered = rendered.replaceAll("{ $('session-config').item.json.bevySessionTime }", sessionTime);

  const checkinDeadline = data.checkinDeadline ?? "13:30 WIB";
  rendered = rendered.replaceAll("{{ $('session-config').item.json.bevyCheckinDeadline }}", checkinDeadline);
  rendered = rendered.replaceAll("{ $('session-config').item.json.bevyCheckinDeadline }", checkinDeadline);

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

    const attendeeCode = data.attendeeCode ?? "GDG-JKT-89241";
    rendered = rendered.replaceAll("{{ $('add-bevy-attendee-api').item.json.attendee_code }}", attendeeCode);
    rendered = rendered.replaceAll("{ $('add-bevy-attendee-api').item.json.attendee_code }", attendeeCode);
    rendered = rendered.replaceAll("{{ $('Add Bevy Attendee API').item.json.id }}", attendeeCode);
    rendered = rendered.replaceAll("{ $('Add Bevy Attendee API').item.json.id }", attendeeCode);
    rendered = rendered.replaceAll("{{ $('Add Bevy Attendee API').item.json.attendee_code }}", attendeeCode);
    rendered = rendered.replaceAll("{ $('Add Bevy Attendee API').item.json.attendee_code }", attendeeCode);
  }

  return rendered;
}

/**
 * Adjusts body HTML for the approved attendee webhook request so the QR Code
 * can be replaced dynamically by n8n's "Generate QR Code" node in the workflow.
 */
export function adjustBodyEmailForApprovedWebhook(html: string): string {
  let adjusted = html;

  // 1. Replace hardcoded SAMPLE_QR_CODE_BASE64 with the n8n Generate QR Code expression
  adjusted = adjusted.replaceAll(SAMPLE_QR_CODE_BASE64, "{{ $('Generate QR Code').item.json.qrCode }}");

  // 2. Ensure any img with qr-img class has the n8n Generate QR Code expression if it does not already
  adjusted = adjusted.replace(
    /(<img\b[^>]*class=["'][^"']*qr-img[^"']*["'][^>]*src=["'])([^"']+)(["'][^>]*>)/gi,
    (_match, prefix, _src, suffix) => {
      return `${prefix}data:image/png;base64,{{ $('Generate QR Code').item.json.qrCode }}${suffix}`;
    },
  );

  // 3. Update legacy attendee reference code node name to matching n8n node "Add Bevy Attendee API"
  adjusted = adjusted.replaceAll(
    "{{ $('add-bevy-attendee-api').item.json.attendee_code }}",
    "{{ $('Add Bevy Attendee API').item.json.id }}",
  );
  adjusted = adjusted.replaceAll(
    "{ $('add-bevy-attendee-api').item.json.attendee_code }",
    "{{ $('Add Bevy Attendee API').item.json.id }}",
  );

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
