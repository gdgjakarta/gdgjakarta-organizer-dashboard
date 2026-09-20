export const defaultHtmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GDG Jakarta Update</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      color: #1e293b;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .header-image {
      width: 100%;
      height: auto;
      display: block;
    }
    .content {
      padding: 32px 24px;
      line-height: 1.6;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
    }
    p {
      margin: 0 0 16px;
      font-size: 15px;
      color: #334155;
    }
    .btn-container {
      margin: 24px 0;
      text-align: center;
    }
    .btn {
      display: inline-block;
      background-color: #1a73e8;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <img src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png" alt="GDG Jakarta" class="header-image" />
    <div class="content">
      <h1>Hello [[Name]],</h1>
      <p>We are excited to share an update regarding <strong>[[EventName]]</strong>!</p>
      <p>Thank you for being an active part of our Google Developer Groups Jakarta community. We have lined up insightful sessions and engaging activities designed to help you connect, learn, and grow.</p>
      <div class="btn-container">
        <a href="https://gdg.community.dev/gdg-jakarta/" class="btn">View Event Details</a>
      </div>
      <p>If you have any questions or need further assistance, please feel free to reply to this email or reach out to our organizer team.</p>
      <p>Best regards,<br><strong>GDG Jakarta Organizer Team</strong></p>
    </div>
    <div class="footer">
      <p style="margin: 0;">You received this email because you registered for a GDG Jakarta event.</p>
      <p style="margin: 4px 0 0;">Google Developer Groups Jakarta &bull; Jakarta, Indonesia</p>
    </div>
  </div>
</body>
</html>`;
