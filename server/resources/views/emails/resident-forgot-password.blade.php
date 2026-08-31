<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Password Reset</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f9fa;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8f9fa;padding:40px 20px;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #f1f3f5;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.02);">
                <tr>
                    <td style="padding:48px 40px;text-align:center;">
                        
                        <!-- Header / Logo Area -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                            <tr>
                                <td align="center">
                                    <div style="display:inline-block;background-color:#f1f5f9;padding:12px;border-radius:12px;margin-bottom:12px;">
                                        <h1 style="margin:0;font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">Gate Access System</h1>
                                    </div>
                                </td>
                            </tr>
                        </table>

                        <h2 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#1e293b;">Your new password!</h2>
                        <p style="margin:0 0 40px;font-size:15px;color:#64748b;">
                            We generated a new password for <strong>{{ $fullName }}</strong> to access the {{ $subdivisionName }} portal.
                        </p>

                        <!-- Password Box (Styled like the OTP boxes in the image) -->
                        <p style="margin:0 0 12px;font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">New Password</p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:40px;">
                            <tr>
                                <td align="center">
                                    <div style="display:inline-block;padding:16px 32px;border:2px solid #fef3c7;border-radius:12px;background-color:#fffbeb;">
                                        <span style="font-size:28px;font-weight:700;color:#f59e0b;letter-spacing:2px;font-family:ui-monospace,Menlo,Consolas,monospace;">
                                            {{ $password }}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        </table>

                        <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
                            Please log in and change this password immediately.<br>
                            Do not share these credentials with anyone.
                        </p>
                        
                        <!-- Login Button / Link -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:48px;">
                            <tr>
                                <td align="center">
                                    <a href="{{ $portalUrl }}" style="display:inline-block;padding:12px 24px;background-color:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;font-size:15px;">Go to Portal</a>
                                </td>
                            </tr>
                        </table>

                        <!-- Footer Links -->
                        <hr style="border:0;border-top:1px solid #f1f5f9;margin:0 0 24px;">
                        
                        <p style="margin:0;font-size:13px;color:#94a3b8;">
                            If you did not request this, feel free to reach out to security at<br>
                            <a href="mailto:{{ $securityEmail }}" style="color:#64748b;text-decoration:underline;">{{ $securityEmail }}</a>
                        </p>

                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
