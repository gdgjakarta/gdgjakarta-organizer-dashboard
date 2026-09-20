export const defaultHtmlTemplate = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GDG Jakarta Update</title>
    <style>
        /* Reset styles for email clients */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        
        /* Mobile responsiveness */
        @media screen and (max-width: 600px) {
            .container { width: 100% !important; padding: 0 10px !important; }
            .content-padding { padding: 20px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #3c4043;">

    <center>
        <table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f4f6f8">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    
                    <!-- Main Container -->
                    <table class="container" width="600" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        
                        <!-- Header with Google Colors -->
                        <tr>
                            <td style="height: 6px; background: linear-gradient(to right, #4285F4 25%, #EA4335 25%, #EA4335 50%, #FBBC05 50%, #FBBC05 75%, #34A853 75%);"></td>
                        </tr>
                        <tr>
                            <td align="center" style="background-color: #ffffff; border-bottom: 1px solid #eeeeee;">
                                <img src="https://assets.gdgjakarta.org/gdg-jakarta/gdg-jakarta-emailheaders-1244x388-blue.png" alt="GDG Jakarta Header" style="width: 100%; max-width: 600px; height: auto; display: block; border: 0;" />
                            </td>
                        </tr>

                        <!-- Body Content -->
                        <tr>
                            <td class="content-padding" style="padding: 40px 40px 20px 40px;">
                                <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #202124;">Halo Developers! 👋</h2>
                                
                                <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #5f6368;">
                                    We are excited to invite you to our upcoming <strong>[Insert Event Name, e.g., Google I/O Extended Jakarta]</strong>. Get ready to learn about the latest technologies, network with fellow developers, and build amazing things together!
                                </p>

                                <!-- Event Details Box -->
                                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 25px;">
                                    <tr>
                                        <td style="padding: 20px;">
                                            <p style="margin: 0 0 10px 0; font-size: 15px; color: #3c4043;">
                                                <strong>📅 Date:</strong> [Day, Date Month Year]
                                            </p>
                                            <p style="margin: 0 0 10px 0; font-size: 15px; color: #3c4043;">
                                                <strong>⏰ Time:</strong> [Start Time] - [End Time] WIB
                                            </p>
                                            <p style="margin: 0 0 10px 0; font-size: 15px; color: #3c4043;">
                                                <strong>📍 Location:</strong> [Venue Name / Online Meet Link]
                                            </p>
                                            <p style="margin: 0; font-size: 15px; color: #3c4043;">
                                                <strong>🎤 Speaker:</strong> [Speaker Name & Title]
                                            </p>
                                        </td>
                                    </tr>
                                </table>

                                <p style="margin: 0 0 25px 0; font-size: 16px; line-height: 1.6; color: #5f6368;">
                                    Spaces are limited, so make sure to secure your spot as soon as possible. Don't forget to bring your laptop if you want to follow along with the codelabs!
                                </p>

                                <!-- Call to Action Button -->
                                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center">
                                            <a href="[Insert RSVP Link Here]" target="_blank" style="display: inline-block; padding: 14px 30px; background-color: #4285F4; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 6px;">
                                                RSVP Now
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Closing -->
                        <tr>
                            <td class="content-padding" style="padding: 20px 40px 40px 40px;">
                                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #5f6368;">
                                    Keep building,<br>
                                    <strong>The GDG Jakarta Team</strong>
                                </p>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="padding: 30px 20px; background-color: #f8f9fa; border-top: 1px solid #eeeeee; text-align: center;">
                                <p style="margin: 0 0 15px 0; font-size: 14px; color: #80868b;">
                                    Follow us for more updates:
                                </p>
                                
                                <!-- Social Links (Text based for simplicity, can replace with icons) -->
                                <p style="margin: 0 0 20px 0; font-size: 14px;">
                                    <a href="[Insert Instagram Link]" style="color: #4285F4; text-decoration: none; margin: 0 10px;">Instagram</a> | 
                                    <a href="[Insert LinkedIn Link]" style="color: #4285F4; text-decoration: none; margin: 0 10px;">LinkedIn</a> | 
                                    <a href="[Insert GDG Platform Link]" style="color: #4285F4; text-decoration: none; margin: 0 10px;">GDG Platform</a>
                                </p>

                                <p style="margin: 0; font-size: 12px; color: #bdc1c6;">
                                    You received this email because you are registered as a member of Google Developer Groups Jakarta.<br>
                                    <a href="[Unsubscribe Link]" style="color: #bdc1c6; text-decoration: underline;">Unsubscribe</a> from future updates.
                                </p>
                            </td>
                        </tr>

                    </table>
                    <!-- End Main Container -->

                </td>
            </tr>
        </table>
    </center>

</body>
</html>
`;
