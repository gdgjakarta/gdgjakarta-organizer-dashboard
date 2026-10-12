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
