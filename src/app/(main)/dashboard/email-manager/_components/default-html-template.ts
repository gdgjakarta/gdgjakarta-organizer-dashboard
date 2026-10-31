import type { AudienceType } from "../_types/audience";

export const defaultHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Update regarding: [[EventName]]</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Poppins', sans-serif;
        background-color: #f1f3f4;
        color: #3c4043;
      }

      .container {
        max-width: 510px;
        margin: 0 auto;
        background-color: #ffffff;
        padding: 30px;
        border-radius: 8px;
      }

      .header-img {
        width: 100%;
        height: auto;
        border-radius: 8px 8px 0 0;
        background-color: #4285f4;
        min-height: 100px;
      }

      .center {
        text-align: center;
      }

      .start {
        text-align: start;
      }

      /* Ticket Styles */
      .ticket-card {
        background-color: #f8f9fa;
        border: 2px dashed #4285f4;
        border-radius: 12px;
        padding: 25px;
        margin: 25px 0;
        text-align: center;
        position: relative;
      }

      .ticket-title {
        color: #4285f4;
        font-weight: 600;
        margin-bottom: 5px;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-size: 0.9em;
      }

      .qr-placeholder {
        background-color: #ffffff;
        padding: 10px;
        border-radius: 8px;
        display: inline-block;
        margin: 15px 0;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      }

      .qr-img {
        width: 200px;
        height: 200px;
        display: block;
      }

      .attendee-name {
        font-size: 1.3em;
        font-weight: 600;
        color: #202124;
        margin: 5px 0;
      }

      .attendee-id {
        display: inline-block;
        background-color: #e8f0fe;
        color: #1967d2;
        padding: 4px 12px;
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 25px;
      }

      .details-box {
        background-color: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 15px;
        margin-top: 20px;
        text-align: left;
      }

      .detail-row {
        display: flex;
        margin-bottom: 10px;
      }

      .detail-row:last-child {
        margin-bottom: 0;
      }

      .detail-icon {
        margin-right: 10px;
        font-size: 1.1em;
      }

      /* Reminder Checklist Styles */
      .checklist-box {
        background-color: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 20px;
        margin: 25px 0;
      }

      .checklist-item {
        margin-bottom: 15px;
        display: flex;
        align-items: flex-start;
      }

      .checklist-item:last-child {
        margin-bottom: 0;
      }

      .icon {
        margin-right: 12px;
        font-size: 1.2em;
        min-width: 25px;
      }

      .text {
        font-size: 0.95em;
        line-height: 1.5;
      }

      /* Button Styles */
      .btn {
        display: block;
        background-color: #4285f4;
        color: #ffffff !important;
        text-align: center;
        border-radius: 50px;
        padding: 12px 24px;
        text-decoration: none;
        width: 70%;
        margin: 20px auto;
        font-weight: 600;
        font-size: 15px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }
      
      .btn:hover {
        background-color: #3367d6;
      }

      /* Info Box */
      .info-box {
        background-color: #fce8e6;
        border: 1px solid #ea4335;
        border-radius: 8px;
        padding: 16px;
        margin: 24px 0;
        color: #b31412;
      }

      .info-box p {
        margin-top: 0;
        margin-bottom: 16px;
        line-height: 1.6;
      }

      .info-box p:last-child {
        margin-bottom: 0;
      }

      /* Global Content Elements */
      .footer {
        margin-top: 24pt;
        padding: 18pt;
        background-color: #f8f9fa;
        border-radius: 0 0 8px 8px;
        text-align: center;
      }

      .content {
        padding: 0 15px;
      }

      p {
        line-height: 1.6;
        margin-bottom: 15px;
      }

      strong {
        color: #202124;
      }

      a.location-link {
        color: #1a73e8;
        text-decoration: none;
        font-weight: 600;
      }

      a.location-link:hover {
        text-decoration: underline;
      }

      code {
        background-color: #f1f3f4;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'Courier New', Courier, monospace;
        font-size: 0.9em;
        color: #c5221f;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="center">
        <!-- Header Image -->
        <img src="[[EventBannerUrl]]" onerror="this.src='https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png'" alt="Event Header" class="header-img" />
      </div>
      
      <div class="content">
        <div class="start">
          <h2>Hi [[Name]],</h2>
        </div>
        
        <div class="start">
          <p>We are excited to share an update regarding <strong>[[EventName]]</strong>!</p>
          
          <p>Thank you for being an active part of our Google Developer Groups Jakarta community. We have lined up insightful sessions and engaging activities designed to help you connect, learn, and grow.</p>

          <!-- Important Notes Checklist -->
          <div class="checklist-box">
            <h3 style="margin-top: 0; color: #4285f4;">📝 Important Event Notes</h3>
            <div class="checklist-item">
              <div class="icon">📅</div>
              <div class="text"><strong>Date &amp; Time:</strong> [[EventDate]] at [[EventTime]]</div>
            </div>
            <div class="checklist-item">
              <div class="icon">📍</div>
              <div class="text"><strong>Location:</strong> <a href="[[EventUrl]]" class="location-link" target="_blank">[[EventVenue]]</a></div>
            </div>
          </div>

          <a href="[[EventUrl]]" class="btn">See you at the venue! 🚀</a>

          <p style="margin-top: 30px; font-size: 0.9em; color: #5f6368;">
            Thank you for being part of the GDG Jakarta community, and we hope to see you soon!
          </p>
        </div>
      </div>
      
      <div class="center">
        <div class="footer">
          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />
        </div>
      </div>
    </div>
  </body>
</html>`;

export const speakerInvitationHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Invitation to Speak at [[EventName]]</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Poppins', sans-serif;
        background-color: #f1f3f4;
        color: #3c4043;
      }

      .container {
        max-width: 510px;
        margin: 0 auto;
        background-color: #ffffff;
        padding: 30px;
        border-radius: 8px;
      }

      .header-img {
        width: 100%;
        height: auto;
        border-radius: 8px 8px 0 0;
        background-color: #4285f4;
        min-height: 100px;
      }

      .center {
        text-align: center;
      }

      .start {
        text-align: start;
      }

      .speaker-card {
        background-color: #f8f9fa;
        border: 2px dashed #4285f4;
        border-radius: 12px;
        padding: 24px;
        margin: 24px 0;
        text-align: left;
      }

      .speaker-title {
        color: #4285f4;
        font-weight: 600;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-size: 0.85em;
      }

      .session-highlight {
        font-size: 1.25em;
        font-weight: 600;
        color: #202124;
        margin: 4px 0 16px 0;
        line-height: 1.4;
      }

      .details-box {
        background-color: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 16px;
        margin-top: 12px;
      }

      .detail-row {
        display: flex;
        margin-bottom: 12px;
      }

      .detail-row:last-child {
        margin-bottom: 0;
      }

      .detail-icon {
        margin-right: 12px;
        font-size: 1.15em;
      }

      .checklist-box {
        background-color: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 20px;
        margin: 25px 0;
      }

      .checklist-item {
        margin-bottom: 15px;
        display: flex;
        align-items: flex-start;
      }

      .checklist-item:last-child {
        margin-bottom: 0;
      }

      .icon {
        margin-right: 12px;
        font-size: 1.2em;
        min-width: 25px;
      }

      .text {
        font-size: 0.95em;
        line-height: 1.5;
      }

      .btn {
        display: block;
        background-color: #4285f4;
        color: #ffffff !important;
        text-align: center;
        border-radius: 50px;
        padding: 12px 24px;
        text-decoration: none;
        width: 75%;
        margin: 25px auto;
        font-weight: 600;
        font-size: 15px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }
      
      .btn:hover {
        background-color: #3367d6;
      }

      .footer {
        margin-top: 24pt;
        padding: 18pt;
        background-color: #f8f9fa;
        border-radius: 0 0 8px 8px;
        text-align: center;
      }

      .content {
        padding: 0 15px;
      }

      p {
        line-height: 1.6;
        margin-bottom: 15px;
      }

      strong {
        color: #202124;
      }

      a.location-link {
        color: #1a73e8;
        text-decoration: none;
        font-weight: 600;
      }

      a.location-link:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="center">
        <!-- Header Image -->
        <img src="[[EventBannerUrl]]" onerror="this.src='https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png'" alt="Event Header" class="header-img" />
      </div>
      
      <div class="content">
        <div class="start">
          <h2>Hi [[Name]],</h2>
        </div>
        
        <div class="start">
          <p>On behalf of Google Developer Groups (GDG) Jakarta, we are excited to invite you as a <strong>Featured Speaker</strong> at <strong>[[EventName]]</strong>!</p>
          
          <p>Our community of engineers, builders, and tech enthusiasts in Jakarta is eager to learn from your expertise, real-world experience, and technical leadership.</p>

          <!-- Speaker Session Card -->
          <div class="speaker-card">
            <div class="speaker-title">🎤 Proposed Session Topic</div>
            <div class="session-highlight">[[SessionTitle]]</div>
            
            <div class="details-box">
              <div class="detail-row">
                <span class="detail-icon">📅</span>
                <div>
                  <strong>Event Date</strong><br>
                  [[EventDate]]
                </div>
              </div>
              <div class="detail-row">
                <span class="detail-icon">⏰</span>
                <div>
                  <strong>Session Time</strong><br>
                  [[EventTime]]
                </div>
              </div>
              <div class="detail-row">
                <span class="detail-icon">📍</span>
                <div>
                  <strong>Venue Location</strong><br>
                  <a href="[[EventUrl]]" class="location-link" target="_blank">[[EventVenue]]</a>
                  <div style="font-size: 0.85em; color: #5f6368; margin-top: 2px;">[[EventAddress]]</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Speaker Preparation Checklist -->
          <div class="checklist-box">
            <h3 style="margin-top: 0; color: #4285f4;">📋 Speaker Next Steps &amp; Guidelines</h3>
            <div class="checklist-item">
              <div class="icon">✅</div>
              <div class="text"><strong>Confirm Availability:</strong> Please confirm your participation and reply with your updated bio and speaker profile photo.</div>
            </div>
            <div class="checklist-item">
              <div class="icon">📖</div>
              <div class="text">
                <strong>Read the Speaker Handbook:</strong> Review our comprehensive <a href="https://gdgjakarta.org/speaker-handbook" target="_blank" style="color: #1a73e8; font-weight: 600; text-decoration: underline;">GDG Jakarta Speaker Handbook</a> for presentation guidelines, code of conduct, AV setup recommendations, and community best practices.
              </div>
            </div>
            <div class="checklist-item">
              <div class="icon">💻</div>
              <div class="text"><strong>Presentation Deck:</strong> We recommend 16:9 widescreen format. Please share your draft slides 3 days before the event.</div>
            </div>
            <div class="checklist-item">
              <div class="icon">⏱️</div>
              <div class="text"><strong>Technical Run-Through:</strong> Please arrive at least 30 minutes before your slot for microphone, clicker, and screen display checks.</div>
            </div>
          </div>

          <!-- Speaker Handbook Quick Link Card -->
          <div style="background-color: #e8f0fe; border-left: 4px solid #4285f4; border-radius: 4px; padding: 14px 18px; margin: 20px 0;">
            <p style="margin: 0; font-size: 0.9em; color: #1a73e8; line-height: 1.5;">
              📘 <strong>Speaker Resource:</strong> Access the full <a href="https://gdgjakarta.org/speaker-handbook" target="_blank" style="color: #1a73e8; font-weight: 600; text-decoration: underline;">Speaker Handbook &amp; Deck Templates</a> anytime for slide templates, brand assets, and stage guidance.
            </p>
          </div>

          <a href="[[EventUrl]]" class="btn">Confirm Participation &amp; View Details 🚀</a>

          <p style="margin-top: 25px; font-size: 0.9em; color: #5f6368;">
            If you have any questions, scheduling constraints, or presentation requirements, simply reply to this email. We would be honored to have you on stage!
          </p>
        </div>
      </div>
      
      <div class="center">
        <div class="footer">
          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />
        </div>
      </div>
    </div>
  </body>
</html>`;

export const memberRegisterInvitationHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>You're Invited: [[EventName]]</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Poppins', sans-serif;
        background-color: #f1f3f4;
        color: #3c4043;
      }

      .container {
        max-width: 510px;
        margin: 0 auto;
        background-color: #ffffff;
        padding: 30px;
        border-radius: 8px;
      }

      .header-img {
        width: 100%;
        height: auto;
        border-radius: 8px 8px 0 0;
        background-color: #4285f4;
        min-height: 100px;
      }

      .center {
        text-align: center;
      }

      .start {
        text-align: start;
      }

      .details-box {
        background-color: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 16px;
        margin: 20px 0;
      }

      .detail-row {
        display: flex;
        margin-bottom: 12px;
      }

      .detail-row:last-child {
        margin-bottom: 0;
      }

      .detail-icon {
        margin-right: 12px;
        font-size: 1.15em;
      }

      .checklist-box {
        background-color: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 20px;
        margin: 25px 0;
      }

      .checklist-item {
        margin-bottom: 15px;
        display: flex;
        align-items: flex-start;
      }

      .checklist-item:last-child {
        margin-bottom: 0;
      }

      .icon {
        margin-right: 12px;
        font-size: 1.2em;
        min-width: 25px;
      }

      .text {
        font-size: 0.95em;
        line-height: 1.5;
      }

      .btn {
        display: block;
        background-color: #4285f4;
        color: #ffffff !important;
        text-align: center;
        border-radius: 50px;
        padding: 14px 28px;
        text-decoration: none;
        width: 75%;
        margin: 25px auto;
        font-weight: 600;
        font-size: 15px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }
      
      .btn:hover {
        background-color: #3367d6;
      }

      .footer {
        margin-top: 24pt;
        padding: 18pt;
        background-color: #f8f9fa;
        border-radius: 0 0 8px 8px;
        text-align: center;
      }

      .content {
        padding: 0 15px;
      }

      p {
        line-height: 1.6;
        margin-bottom: 15px;
      }

      strong {
        color: #202124;
      }

      a.location-link {
        color: #1a73e8;
        text-decoration: none;
        font-weight: 600;
      }

      a.location-link:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="center">
        <!-- Header Image -->
        <img src="[[EventBannerUrl]]" onerror="this.src='https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png'" alt="Event Header" class="header-img" />
      </div>
      
      <div class="content">
        <div class="start">
          <h2>Hi [[Name]],</h2>
        </div>
        
        <div class="start">
          <p>Registration is officially open for <strong>[[EventName]]</strong>! We would love for you to join us for an inspiring session packed with cutting-edge technology, live demos, and community networking.</p>
          
          <p>[[EventDescription]]</p>

          <!-- Event Details Box -->
          <div class="details-box">
            <h3 style="margin-top: 0; color: #4285f4;">📅 Event Schedule &amp; Venue</h3>
            <div class="detail-row">
              <span class="detail-icon">🗓️</span>
              <div>
                <strong>Date &amp; Time</strong><br>
                [[EventDate]] at [[EventTime]]
              </div>
            </div>
            <div class="detail-row">
              <span class="detail-icon">📍</span>
              <div>
                <strong>Venue Location</strong><br>
                <a href="[[EventUrl]]" class="location-link" target="_blank">[[EventVenue]]</a>
                <div style="font-size: 0.85em; color: #5f6368; margin-top: 2px;">[[EventAddress]]</div>
              </div>
            </div>
            <div class="detail-row">
              <span class="detail-icon">🎟️</span>
              <div>
                <strong>Admission Pass</strong><br>
                Complimentary Community Registration
              </div>
            </div>
          </div>

          <!-- What to Expect Checklist -->
          <div class="checklist-box">
            <h3 style="margin-top: 0; color: #4285f4;">✨ What's in Store for You</h3>
            <div class="checklist-item">
              <div class="icon">💡</div>
              <div class="text"><strong>Cutting-Edge Insights:</strong> Explore the latest Google technologies, AI advancements, and developer best practices.</div>
            </div>
            <div class="checklist-item">
              <div class="icon">🤝</div>
              <div class="text"><strong>Community Networking:</strong> Connect with fellow software engineers, designers, tech leads, and founders in Jakarta.</div>
            </div>
            <div class="checklist-item">
              <div class="icon">🎁</div>
              <div class="text"><strong>Exclusive GDG Swag:</strong> Limited edition stickers, event badge, and refreshments provided at the venue.</div>
            </div>
          </div>

          <a href="[[EventUrl]]" class="btn">Register for [[EventName]] 🚀</a>

          <p style="margin-top: 25px; font-size: 0.9em; color: #5f6368; text-align: center;">
            Seats are limited on a first-come, first-served basis. Secure your registration today!
          </p>
        </div>
      </div>
      
      <div class="center">
        <div class="footer">
          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />
        </div>
      </div>
    </div>
  </body>
</html>`;

export const memberOnlineInvitationHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Join Us Live Online: [[EventName]]</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Poppins', sans-serif;
        background-color: #f1f3f4;
        color: #3c4043;
      }

      .container {
        max-width: 510px;
        margin: 0 auto;
        background-color: #ffffff;
        padding: 30px;
        border-radius: 8px;
      }

      .header-img {
        width: 100%;
        height: auto;
        border-radius: 8px 8px 0 0;
        background-color: #1a73e8;
        min-height: 100px;
      }

      .center {
        text-align: center;
      }

      .start {
        text-align: start;
      }

      .virtual-box {
        background-color: #e8f0fe;
        border: 1px solid #4285f4;
        border-radius: 8px;
        padding: 18px;
        margin: 20px 0;
      }

      .detail-row {
        display: flex;
        margin-bottom: 12px;
      }

      .detail-row:last-child {
        margin-bottom: 0;
      }

      .detail-icon {
        margin-right: 12px;
        font-size: 1.15em;
      }

      .checklist-box {
        background-color: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 20px;
        margin: 25px 0;
      }

      .checklist-item {
        margin-bottom: 15px;
        display: flex;
        align-items: flex-start;
      }

      .checklist-item:last-child {
        margin-bottom: 0;
      }

      .icon {
        margin-right: 12px;
        font-size: 1.2em;
        min-width: 25px;
      }

      .text {
        font-size: 0.95em;
        line-height: 1.5;
      }

      .btn {
        display: block;
        background-color: #1a73e8;
        color: #ffffff !important;
        text-align: center;
        border-radius: 50px;
        padding: 14px 28px;
        text-decoration: none;
        width: 75%;
        margin: 25px auto;
        font-weight: 600;
        font-size: 15px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }
      
      .btn:hover {
        background-color: #1557b0;
      }

      .footer {
        margin-top: 24pt;
        padding: 18pt;
        background-color: #f8f9fa;
        border-radius: 0 0 8px 8px;
        text-align: center;
      }

      .content {
        padding: 0 15px;
      }

      p {
        line-height: 1.6;
        margin-bottom: 15px;
      }

      strong {
        color: #202124;
      }

      a.location-link {
        color: #1a73e8;
        text-decoration: none;
        font-weight: 600;
      }

      a.location-link:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="center">
        <!-- Header Image -->
        <img src="[[EventBannerUrl]]" onerror="this.src='https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png'" alt="Event Header" class="header-img" />
      </div>
      
      <div class="content">
        <div class="start">
          <h2>Hi [[Name]],</h2>
        </div>
        
        <div class="start">
          <p>You are invited to join <strong>[[EventName]]</strong> live online! Connect virtually with the community and enjoy our sessions from the comfort of your desk.</p>
          
          <p>[[EventDescription]]</p>

          <!-- Virtual Access Box -->
          <div class="virtual-box">
            <h3 style="margin-top: 0; color: #1967d2;">💻 Virtual Event &amp; Livestream Details</h3>
            <div class="detail-row">
              <span class="detail-icon">📅</span>
              <div>
                <strong>Broadcast Date &amp; Time</strong><br>
                [[EventDate]] at [[EventTime]]
              </div>
            </div>
            <div class="detail-row">
              <span class="detail-icon">🌐</span>
              <div>
                <strong>Online Platform</strong><br>
                [[EventVenue]]
              </div>
            </div>
            <div class="detail-row">
              <span class="detail-icon">🔗</span>
              <div>
                <strong>Livestream Access Link</strong><br>
                <a href="[[EventUrl]]" class="location-link" target="_blank">[[EventUrl]]</a>
              </div>
            </div>
          </div>

          <!-- Virtual Participation Checklist -->
          <div class="checklist-box">
            <h3 style="margin-top: 0; color: #1967d2;">🎧 Online Participant Checklist</h3>
            <div class="checklist-item">
              <div class="icon">📶</div>
              <div class="text"><strong>Connection &amp; Audio:</strong> Ensure a stable internet connection and headphones ready for the stream.</div>
            </div>
            <div class="checklist-item">
              <div class="icon">💬</div>
              <div class="text"><strong>Live Q&amp;A Chat:</strong> Prepare your questions! Speakers will take questions live from the chat during the broadcast.</div>
            </div>
            <div class="checklist-item">
              <div class="icon">📂</div>
              <div class="text"><strong>Resources &amp; Recording:</strong> Presentation slides and code repositories will be shared following the event.</div>
            </div>
          </div>

          <a href="[[EventUrl]]" class="btn">Join Online Event 🎥</a>

          <p style="margin-top: 25px; font-size: 0.9em; color: #5f6368; text-align: center;">
            We look forward to having you with us online!
          </p>
        </div>
      </div>
      
      <div class="center">
        <div class="footer">
          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />
        </div>
      </div>
    </div>
  </body>
</html>`;

export const venueTicketHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your Venue Ticket: [[EventName]]</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Poppins', sans-serif;
        background-color: #f1f3f4;
        color: #3c4043;
      }

      .container {
        max-width: 510px;
        margin: 0 auto;
        background-color: #ffffff;
        padding: 30px;
        border-radius: 8px;
      }

      .header-img {
        width: 100%;
        height: auto;
        border-radius: 8px 8px 0 0;
        background-color: #4285f4;
        min-height: 100px;
      }

      .center {
        text-align: center;
      }

      .start {
        text-align: start;
      }

      .ticket-card {
        background-color: #f8f9fa;
        border: 2px dashed #4285f4;
        border-radius: 12px;
        padding: 25px;
        margin: 25px 0;
        text-align: center;
      }

      .ticket-title {
        color: #4285f4;
        font-weight: 600;
        margin-bottom: 5px;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-size: 0.9em;
      }

      .attendee-name {
        font-size: 1.3em;
        font-weight: 600;
        color: #202124;
        margin: 8px 0;
      }

      .attendee-id {
        display: inline-block;
        background-color: #e8f0fe;
        color: #1967d2;
        padding: 6px 14px;
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 18px;
        line-height: 1.35;
      }

      .btn {
        display: block;
        background-color: #4285f4;
        color: #ffffff !important;
        text-align: center;
        border-radius: 50px;
        padding: 12px 24px;
        text-decoration: none;
        width: 75%;
        margin: 18px auto 10px auto;
        font-weight: 600;
        font-size: 15px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }

      .details-box {
        background-color: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 15px;
        margin-top: 20px;
        text-align: left;
      }

      .detail-row {
        display: flex;
        margin-bottom: 10px;
      }

      .detail-row:last-child {
        margin-bottom: 0;
      }

      .detail-icon {
        margin-right: 10px;
        font-size: 1.1em;
      }

      .notice-box {
        background-color: #e8f0fe;
        border-left: 4px solid #4285f4;
        border-radius: 6px;
        padding: 14px 16px;
        margin: 20px 0;
        font-size: 0.9em;
        color: #174ea6;
      }

      .footer {
        margin-top: 24pt;
        padding: 18pt;
        background-color: #f8f9fa;
        border-radius: 0 0 8px 8px;
        text-align: center;
      }

      .content {
        padding: 0 15px;
      }

      p {
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="center">
        <img src="[[EventBannerUrl]]" onerror="this.src='https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png'" alt="Event Header" class="header-img" />
      </div>
      <div class="content">
        <div class="start">
          <h2>Hi [[Name]],</h2>
          <p>Your personal <strong>Venue Ticket</strong> for <strong>[[EventName]]</strong> is ready! 🎟️</p>
          <p>Please open and save your venue pass using the button below before arriving at the venue entrance.</p>

          <div class="ticket-card">
            <div class="ticket-title">Venue Entry Pass</div>
            <div class="attendee-name">[[Name]]</div>
            <div class="attendee-id">
              <div>Ref: [[TicketCode]]</div>
              <div style="margin-top: 2px;">ID: [[AttendeeId]]</div>
            </div>

            <a href="[[VenueTicketUrl]]" class="btn" target="_blank">Open Venue Ticket 🎟️</a>

            <div class="details-box">
              <div class="detail-row">
                <span class="detail-icon">📅</span>
                <div>
                  <strong>Date &amp; Time</strong><br>
                  [[EventDate]] &bull; [[EventTime]]
                </div>
              </div>
              <div class="detail-row">
                <span class="detail-icon">📍</span>
                <div>
                  <strong>Location</strong><br>
                  [[EventVenue]]
                  <div style="margin-top: 4px;">
                    <a href="[[EventVenueUrl]]" style="color: #1a73e8; text-decoration: none; font-weight: 600; font-size: 0.9em;" target="_blank">🗺️ How to get to the venue &rarr;</a>
                  </div>
                </div>
              </div>
              <div class="detail-row">
                <span class="detail-icon">🚗</span>
                <div>
                  <strong>Vehicle / Parking Pass</strong><br>
                  <a href="[[VehicleTicketUrl]]" style="color: #1a73e8; text-decoration: none; font-weight: 600; font-size: 0.9em;" target="_blank">Download Vehicle Ticket &rarr;</a>
                </div>
              </div>
            </div>
          </div>

          <div class="notice-box">
            <strong>🔒 Access Notice:</strong> View-only access to this ticket file has been granted exclusively to your registered email address (<strong>[[Email]]</strong>). Please make sure you are signed in with that Google account when opening the link.
          </div>

          <p style="margin-top: 25px; font-size: 0.9em; color: #5f6368; text-align: center;">
            See you at the venue! 🚀
          </p>
        </div>
      </div>
      <div class="center">
        <div class="footer">
          <img alt="GDG Jakarta" src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-sign-bubble-transparent.png" style="width: 113px; height: auto;" />
        </div>
      </div>
    </div>
  </body>
</html>`;

export interface EmailBlastTemplate {
  id: string;
  name: string;
  description: string;
  badge: string;
  category: "speaker" | "member_register" | "member_online" | "general" | "custom";
  subject: string;
  headerUrl?: string;
  body: string;
  recommendedAudience?: AudienceType;
  isCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_EMAIL_BLAST_TEMPLATES: EmailBlastTemplate[] = [
  {
    id: "tpl-speaker-invitation",
    name: "Speaker Invitation",
    description:
      "Official invitation to speak at [[EventName]] with session title [[SessionTitle]] and Speaker Handbook guidelines.",
    badge: "Speaker Outreach",
    category: "speaker",
    subject: "Invitation to Speak at [[EventName]]: [[SessionTitle]]",
    body: speakerInvitationHtmlTemplate,
    recommendedAudience: "chapter_members",
  },
  {
    id: "tpl-member-register-invitation",
    name: "Member Invitation (Register to Event)",
    description: "Community-wide invitation encouraging members to register and secure their spot.",
    badge: "Member Invitation",
    category: "member_register",
    subject: "You're Invited! Register Now for [[EventName]] 🚀",
    body: memberRegisterInvitationHtmlTemplate,
    recommendedAudience: "chapter_members_without_ticket",
  },
  {
    id: "tpl-member-online-invitation",
    name: "Member Invitation (Join Online Event)",
    description: "Virtual event invitation & livestream access guide for members joining online.",
    badge: "Online Event",
    category: "member_online",
    subject: "Join Us Live Online: [[EventName]] 💻",
    body: memberOnlineInvitationHtmlTemplate,
    recommendedAudience: "ticket_virtual",
  },
  {
    id: "tpl-general-event-update",
    name: "General Event Update",
    description: "Standard event announcement and update template for confirmed attendees.",
    badge: "General Update",
    category: "general",
    subject: "Important Update: [[EventName]]",
    body: defaultHtmlTemplate,
    recommendedAudience: "ticket_all",
  },
];

export const CUSTOM_EMAIL_BLAST_TEMPLATES_KEY = "gdg_custom_email_blast_templates";
export const FEATURE_TEMPLATE_OVERRIDES_KEY = "gdg_feature_email_template_overrides_v1";

export interface FeatureTemplateOverride {
  id: string;
  subject?: string;
  headerUrl?: string;
  body: string;
  updatedAt: string;
}

export function getFeatureTemplateOverrides(): Record<string, FeatureTemplateOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FEATURE_TEMPLATE_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.warn("[getFeatureTemplateOverrides] Failed to load overrides:", err);
    return {};
  }
}

export function saveFeatureTemplateOverride(input: {
  id: string;
  subject?: string;
  headerUrl?: string;
  body: string;
}): FeatureTemplateOverride {
  const current = getFeatureTemplateOverrides();
  const entry: FeatureTemplateOverride = {
    id: input.id,
    subject: input.subject?.trim() || undefined,
    headerUrl: input.headerUrl?.trim() || undefined,
    body: input.body,
    updatedAt: new Date().toISOString(),
  };
  const updated = { ...current, [input.id]: entry };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(FEATURE_TEMPLATE_OVERRIDES_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("[saveFeatureTemplateOverride] Failed to persist override:", err);
    }
  }
  return entry;
}

export function getCustomEmailBlastTemplates(): EmailBlastTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_EMAIL_BLAST_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.warn("[getCustomEmailBlastTemplates] Failed to load custom templates:", err);
    return [];
  }
}

export function saveEmailBlastAsTemplate(input: {
  id?: string;
  name: string;
  description?: string;
  badge?: string;
  subject: string;
  headerUrl?: string;
  body: string;
}): EmailBlastTemplate {
  const current = getCustomEmailBlastTemplates();
  const now = new Date().toISOString();

  const templateId = input.id ?? `custom-tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const template: EmailBlastTemplate = {
    id: templateId,
    name: input.name.trim(),
    description: input.description?.trim() || "Custom user-saved email template",
    badge: input.badge?.trim() || "Custom Template",
    category: "custom",
    subject: input.subject.trim(),
    headerUrl: input.headerUrl?.trim() || undefined,
    body: input.body,
    isCustom: true,
    createdAt: input.id ? (current.find((t) => t.id === input.id)?.createdAt ?? now) : now,
    updatedAt: now,
  };

  const updated = [template, ...current.filter((t) => t.id !== template.id)];

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CUSTOM_EMAIL_BLAST_TEMPLATES_KEY, JSON.stringify(updated.slice(0, 30)));
    } catch (err) {
      console.warn("[saveEmailBlastAsTemplate] Failed to persist custom template:", err);
    }
  }

  return template;
}

export function deleteCustomEmailBlastTemplate(templateId: string): void {
  if (typeof window === "undefined") return;
  const current = getCustomEmailBlastTemplates();
  const updated = current.filter((t) => t.id !== templateId);
  try {
    window.localStorage.setItem(CUSTOM_EMAIL_BLAST_TEMPLATES_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[deleteCustomEmailBlastTemplate] Failed to delete template:", err);
  }
}

export function getAllEmailBlastTemplates(): {
  defaultTemplates: EmailBlastTemplate[];
  customTemplates: EmailBlastTemplate[];
} {
  return {
    defaultTemplates: DEFAULT_EMAIL_BLAST_TEMPLATES,
    customTemplates: getCustomEmailBlastTemplates(),
  };
}
