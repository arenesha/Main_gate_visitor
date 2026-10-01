import nodemailer from 'nodemailer';

try {
  if (typeof process !== 'undefined' && process.loadEnvFile) {
    process.loadEnvFile();
  }
} catch (e) {
  // Ignore if .env is missing
}

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
};

const transporter = nodemailer.createTransport(SMTP_CONFIG);

function formatPassDate(dateString) {
  try {
    let s = String(dateString).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) {
      s = `${s}+05:30`;
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return dateString;
    const optionsDate = { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' };
    const optionsTime = { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' };
    const datePart = d.toLocaleDateString('en-US', optionsDate);
    const timePart = d.toLocaleTimeString('en-US', optionsTime);
    return `${datePart} at ${timePart}`;
  } catch (e) {
    return dateString;
  }
}

/**
 * Sends official Visitor Pass email
 */
export async function sendVisitorPassEmail(passData) {
  const {
    id = 'INV-EJRG38',
    visitor_name = 'Priti',
    visitor_email,
    host_name = 'AreneSHA Workspace',
    host_department = 'B-Block, MEENAKSHI TECH PARK,\n11th, Gachibowli, Hyderabad,\nTelangana 500032',
    purpose = 'workspace',
    vehicle_number,
    entry_code = '264615',
    valid_from,
    valid_until,
    public_url
  } = passData;

  const targetRecipient = (visitor_email && visitor_email.includes('@'))
    ? visitor_email.trim()
    : null;

  if (!targetRecipient) {
    console.log(`[Email Dispatch] Skipped visitor pass email: No valid visitor email provided for pass ${id}`);
    return { success: false, skipped: true, message: 'No valid visitor email provided' };
  }

  const senderEmail = process.env.SMTP_USER || 'arenesha.reception@gmail.com';

  const formattedFrom = valid_from ? formatPassDate(valid_from) : 'September 22, 2026 at 10:06 AM';
  const formattedUntil = valid_until ? formatPassDate(valid_until) : 'September 23, 2026 at 10:06 AM';

  const hostDisplay = (host_name && host_name.trim().length > 0) ? host_name.trim() : 'AreneSHA Workspace';
  const visitorDisplay = (visitor_name && visitor_name.trim().length > 0) ? visitor_name.trim() : 'Priti';
  const purposeDisplay = (purpose && purpose.trim().length > 0) ? purpose.trim() : 'workspace';
  
  const addressText = (host_department && host_department.trim().length > 0)
    ? host_department.trim()
    : 'B-Block, MEENAKSHI TECH PARK,\n11th, Gachibowli, Hyderabad,\nTelangana 500032';
  const formattedAddressHtml = addressText.replace(/\n/g, '<br/>');

  const qrData = passData.qr_token || 'QR_1ebfd1217935ef9039075c15ad32e1304f675c44642792de';
  const qrImageUrl = passData.qr_image_url || `https://quickchart.io/qr?text=${encodeURIComponent(qrData)}&size=220&margin=2&ecLevel=H`;
  const mapsUrl = 'https://maps.google.com/?q=Meenakshi+Tech+Park,+Gachibowli,+Hyderabad,+Telangana 500032';
  const livePassUrl = public_url || `http://localhost:5173/invitation/${id}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${hostDisplay} has invited ${visitorDisplay}.</title>
    </head>
    <body style="margin: 0; padding: 20px 10px; background-color: #EFE9DF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 420px; margin: 0 auto; background-color: #FAF8F5; border-radius: 24px; overflow: hidden; border: 1px solid #E6DEC8; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
        
        <!-- TOP HEADER: Host Invitation -->
        <tr>
          <td align="center" style="padding: 26px 20px 12px 20px; text-align: center;">
            <h1 style="font-size: 22px; color: #1E1E1E; margin: 0 0 6px 0; font-weight: 800; letter-spacing: -0.02em; line-height: 1.25;">
              ${hostDisplay}<br/>has invited ${visitorDisplay}.
            </h1>
          </td>
        </tr>

        <!-- VALIDITY DATE & TIME WINDOW -->
        <tr>
          <td align="center" style="padding: 0 20px 12px 20px; text-align: center;">
            <div style="font-size: 14px; font-weight: 800; color: #3E3426; line-height: 1.4;">
              ${formattedFrom} to<br/>
              ${formattedUntil}
            </div>
          </td>
        </tr>

        <!-- LOCATION ADDRESS -->
        <tr>
          <td align="center" style="padding: 0 20px 14px 20px; text-align: center;">
            <div style="font-size: 13.5px; font-weight: 600; color: #4A3E2D; line-height: 1.4;">
              ${formattedAddressHtml}
            </div>
          </td>
        </tr>

        <!-- VIEW ON GOOGLE MAPS BUTTON -->
        <tr>
          <td align="center" style="padding: 0 20px 16px 20px; text-align: center;">
            <a href="${mapsUrl}" target="_blank" style="background-color: #13273D; border: 1px solid #1E3A5F; color: #38BDF8; font-size: 12.5px; font-weight: 700; text-decoration: none; padding: 7px 20px; border-radius: 20px; display: inline-block;">
              📍 View on Google Maps
            </a>
          </td>
        </tr>

        <!-- VISITOR & PURPOSE INFO -->
        <tr>
          <td align="center" style="padding: 0 20px 16px 20px; text-align: center;">
            <div style="font-size: 14px; color: #5C5243; line-height: 1.6;">
              <div>Visitor: <strong style="color: #1E1E1E;">${visitorDisplay}</strong></div>
              <div>Purpose: <strong style="color: #1E1E1E;">${purposeDisplay}</strong></div>
            </div>
          </td>
        </tr>

        <!-- VIEW DIGITAL PASS & QR BUTTON -->
        <tr>
          <td align="center" style="padding: 0 20px 20px 20px; text-align: center;">
            <a href="${livePassUrl}" target="_blank" style="background-color: #15304F; border: 1px solid #1E3E66; color: #FFFFFF; font-size: 13.5px; font-weight: 800; text-decoration: none; padding: 10px 24px; border-radius: 10px; display: inline-block; box-shadow: 0 3px 10px rgba(21, 48, 79, 0.25);">
              📱 View Digital Pass & QR
            </a>
          </td>
        </tr>

        <!-- FOOTER BRANDING -->
        <tr>
          <td align="center" style="padding: 14px 20px 18px 20px; border-top: 1px solid #EAE6DF; text-align: center;">
            <div style="font-size: 14px; font-weight: 800; color: #1E1E1E; margin-bottom: 2px;">
              🏢 arenesha
            </div>
            <div style="font-size: 11px; color: #8C8273;">
              Gate Visitor Management System • Pass ID: ${id}
            </div>
          </td>
        </tr>

      </table>

    </body>
    </html>
  `;

  const plainText = `${hostDisplay} has invited ${visitorDisplay} using arenesha.com from ${formattedFrom} to ${formattedUntil}. Please use ${entry_code} as the entry code at the gate. Google coordinates: ${mapsUrl}\n\nVisitor: ${visitorDisplay}\nPurpose: ${purposeDisplay}\nPass ID: ${id}\nDigital Pass: ${livePassUrl}`;

  try {
    const mailOptions = {
      from: `"${hostDisplay}" <${senderEmail}>`,
      to: targetRecipient,
      subject: `${hostDisplay} has invited ${visitorDisplay} • Pass ${id} • OTP: ${entry_code}`,
      html: htmlContent,
      text: plainText
    };
    const info = await transporter.sendMail(mailOptions);

    console.log(`[Email Dispatch] Visitor Pass sent strictly to visitor ${targetRecipient} (MsgID: ${info.messageId})`);
    return { success: true, messageId: info.messageId, recipient: targetRecipient };
  } catch (err) {
    console.error('[Email Dispatch Error]', err);
    return { success: false, error: err.message };
  }
}

/**
 * Sends official "AreneSHA Guard Access Activated" Email to newly authorized Guard
 * Compact ("small mail") layout containing all required points:
 * - Top header: AreneSHA / GATE MANAGEMENT SYSTEM
 * - Greeting: Hello [Name]
 * - Description: You have been authorized as a Guard for the AreneSHA Gate Management system...
 * - Guard account & Location card
 * - Privileges bulleted list
 * - [ OPEN GUARD GATE ] navy button
 * - Security notice
 * - Regards, AreneSHA Team
 * - arenesha • Gate Visitor Management System • Meenakshi Tech Park
 */
export async function sendGuardActivationEmail(guardData) {
  const {
    name = 'AreneSHA Guard',
    email = 'arenesha20@gmail.com',
    location = 'B-Block, MEENAKSHI TECH PARK, 11th, Gachibowli, Hyderabad, Telangana 500032',
    gate_url = 'http://localhost:8788/gate'
  } = guardData || {};

  const senderEmail = process.env.SMTP_USER || 'arenesha.reception@gmail.com';
  const targetRecipient = email.trim();
  const displayName = (name && name.trim().length > 0) ? name.trim() : 'AreneSHA Guard';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AreneSHA Guard Access Activated</title>
    </head>
    <body style="margin: 0; padding: 16px 8px; background-color: #EFE9DF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 410px; margin: 0 auto; background-color: #FAF8F5; border-radius: 22px; overflow: hidden; border: 1px solid #E6DEC8; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
        
        <!-- 1. HEADER: BRANDING -->
        <tr>
          <td align="center" style="padding: 20px 18px 12px 18px; text-align: center; border-bottom: 1px solid #EAE6DF; background-color: #FFFFFF;">
            <div style="font-size: 17px; font-weight: 700; color: #1E1E1E; margin-bottom: 4px; letter-spacing: -0.01em;">
              🏢 AreneSHA
            </div>
            <div style="font-size: 11.5px; font-weight: 800; color: #1E3E47; text-transform: uppercase; letter-spacing: 0.08em;">
              GATE MANAGEMENT SYSTEM
            </div>
          </td>
        </tr>

        <!-- 2. MAIN CONTENT (COMPACT PADDING) -->
        <tr>
          <td style="padding: 18px 20px 16px 20px;">
            
            <h1 style="font-size: 18px; color: #1E1E1E; margin: 0 0 10px 0; font-weight: 800; letter-spacing: -0.01em; line-height: 1.25;">
              Hello ${displayName},
            </h1>

            <p style="font-size: 14px; color: #3D352A; line-height: 1.5; margin: 0 0 8px 0;">
              You have been authorized as a Guard for the <strong>AreneSHA Gate Management</strong> system.
            </p>

            <p style="font-size: 14px; color: #3D352A; line-height: 1.5; margin: 0 0 14px 0;">
              You can now access the Guard Gate to verify visitor invitations and manage visitor entry.
            </p>

            <!-- GUARD ACCOUNT INFO CARD -->
            <div style="background-color: #FFFFFF; border: 1px solid #E6DEC8; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px;">
              <div style="font-size: 10.5px; font-weight: 800; color: #8C8273; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px;">
                GUARD ACCOUNT:
              </div>
              <div style="font-size: 14.5px; font-weight: 800; color: #1E40AF; word-break: break-all; margin-bottom: 4px;">
                ${email}
              </div>
              <div style="font-size: 12.5px; color: #4A3E2D; line-height: 1.4;">
                Location: <strong>${location}</strong>
              </div>
            </div>

            <!-- PRIVILEGES LIST -->
            <div style="font-size: 13.5px; font-weight: 800; color: #1E1E1E; margin-bottom: 8px;">
              Your Guard access allows you to:
            </div>

            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 18px;">
              <tr><td style="padding: 2.5px 0; font-size: 13px; color: #3E3426; line-height: 1.4;">• Open the AreneSHA Guard Gate</td></tr>
              <tr><td style="padding: 2.5px 0; font-size: 13px; color: #3E3426; line-height: 1.4;">• Scan visitor QR codes</td></tr>
              <tr><td style="padding: 2.5px 0; font-size: 13px; color: #3E3426; line-height: 1.4;">• Verify active visitor invitations</td></tr>
              <tr><td style="padding: 2.5px 0; font-size: 13px; color: #3E3426; line-height: 1.4;">• View the required visitor details</td></tr>
              <tr><td style="padding: 2.5px 0; font-size: 13px; color: #3E3426; line-height: 1.4;">• Allow visitor entry</td></tr>
              <tr><td style="padding: 2.5px 0; font-size: 13px; color: #3E3426; line-height: 1.4;">• Deny visitor entry when verification fails</td></tr>
              <tr><td style="padding: 2.5px 0; font-size: 13px; color: #3E3426; line-height: 1.4;">• Record visitor entry at the gate</td></tr>
            </table>

            <!-- OPEN GUARD GATE BUTTON -->
            <div align="center" style="margin: 18px 0 16px 0; text-align: center;">
              <a href="${gate_url}" target="_blank" style="background-color: #152C4E; border: 1px solid #1E3E66; color: #FFFFFF; font-size: 13.5px; font-weight: 800; text-decoration: none; padding: 11px 28px; border-radius: 10px; display: inline-block; box-shadow: 0 3px 12px rgba(21, 44, 78, 0.3); letter-spacing: 0.03em;">
                OPEN GUARD GATE
              </a>
            </div>

            <!-- SECURITY NOTICE -->
            <p style="font-size: 12px; color: #736B5E; line-height: 1.4; margin: 12px 0 14px 0; text-align: center;">
              For security, only use your authorized AreneSHA Guard account to access the Guard Gate.
            </p>

            <!-- REGARDS / SIGN-OFF -->
            <div style="padding-top: 12px; border-top: 1px solid #EAE6DF; font-size: 13px; color: #5C5243; line-height: 1.4;">
              Regards,<br />
              <strong style="color: #1E1E1E;">AreneSHA Team</strong>
            </div>

          </td>
        </tr>

        <!-- 3. FOOTER -->
        <tr>
          <td align="center" style="padding: 12px 18px 16px 18px; border-top: 1px solid #EAE6DF; text-align: center; background-color: #FAF8F5;">
            <div style="font-size: 13px; font-weight: 800; color: #1E1E1E; margin-bottom: 2px;">
              🏢 arenesha
            </div>
            <div style="font-size: 10.5px; color: #8C8273;">
              Gate Visitor Management System • Meenakshi Tech Park
            </div>
          </td>
        </tr>

      </table>

    </body>
    </html>
  `;

  const plainText = `AreneSHA\nGATE MANAGEMENT SYSTEM\nHello ${displayName},\n\nYou have been authorized as a Guard for the AreneSHA Gate Management system.\nYou can now access the Guard Gate to verify visitor invitations and manage visitor entry.\n\nGUARD ACCOUNT:\n${email}\nLocation: ${location}\n\nYour Guard access allows you to:\n• Open the AreneSHA Guard Gate\n• Scan visitor QR codes\n• Verify active visitor invitations\n• View the required visitor details\n• Allow visitor entry\n• Deny visitor entry when verification fails\n• Record visitor entry at the gate\n\nOPEN GUARD GATE: ${gate_url}\n\nFor security, only use your authorized AreneSHA Guard account to access the Guard Gate.\n\nRegards,\nAreneSHA Team\n\narenesha\nGate Visitor Management System • Meenakshi Tech Park`;

  try {
    const mailOptions = {
      from: `"AreneSHA Security" <${senderEmail}>`,
      to: targetRecipient,
      replyTo: senderEmail,
      subject: `AreneSHA Guard Access Activated`,
      html: htmlContent,
      text: plainText,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    };
    const info = await transporter.sendMail(mailOptions);

    console.log(`[Email Dispatch] Real Guard Activation email sent to ${targetRecipient} (MsgID: ${info.messageId})`);
    return { success: true, messageId: info.messageId, recipient: targetRecipient };
  } catch (err) {
    console.error('[Email Dispatch Error - Guard Activation]', err);
    return { success: false, error: err.message };
  }
}

/**
 * Sends official [GATE ALERT] New Visitor Scheduled email to Guard
 */
export async function sendGuardAlertEmail(passData) {
  const {
    id = 'INV-XE2Q7K',
    visitor_name = 'Priti M',
    entry_code = '336650',
    purpose = 'workspace',
    host_name = 'AreneSHA Workspace',
    vehicle_number,
    valid_from,
    guard_email = 'arenesha20@gmail.com'
  } = passData || {};

  const senderEmail = process.env.SMTP_USER || 'arenesha.reception@gmail.com';
  const targetRecipient = guard_email.trim();
  const hostDisplay = (host_name && host_name.trim().length > 0) ? host_name.trim() : 'AreneSHA Workspace';
  const visitorDisplay = (visitor_name && visitor_name.trim().length > 0) ? visitor_name.trim() : 'Visitor';
  const vehicleDisplay = (vehicle_number && vehicle_number.trim().length > 0) ? vehicle_number.trim() : 'None';
  const timeDisplay = valid_from ? new Date(valid_from).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) : new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>[GATE ALERT] New Visitor Scheduled: ${visitorDisplay} • PIN ${entry_code}</title>
    </head>
    <body style="margin: 0; padding: 20px 10px; background-color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; margin: 0 auto; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.25);">
        
        <!-- HEADER -->
        <tr>
          <td style="padding: 24px 28px 18px 28px; background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); color: #FFFFFF;">
            <div style="font-size: 11px; font-weight: 800; color: #38BDF8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">
              AreneSHA Intelligent Security Checkpoint
            </div>
            <h1 style="font-size: 18px; font-weight: 900; margin: 0 0 6px 0; color: #FFFFFF; letter-spacing: -0.01em;">
              NEW VISITOR AUTHORIZATION SCHEDULED
            </h1>
            <div style="font-size: 12px; color: #94A3B8;">
              Security Notice for Guard (<span style="color: #38BDF8;">${targetRecipient}</span>):
            </div>
          </td>
        </tr>

        <!-- DETAILS BODY -->
        <tr>
          <td style="padding: 24px 28px;">
            
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13.5px; border-collapse: separate; border-spacing: 0 8px;">
              <tr>
                <td style="color: #64748B; font-weight: 600; width: 130px;">Visitor Name:</td>
                <td style="color: #0F172A; font-weight: 800; font-size: 15px;">${visitorDisplay}</td>
              </tr>
              <tr>
                <td style="color: #64748B; font-weight: 600;">Pass ID:</td>
                <td style="color: #0284C7; font-weight: 800; font-family: monospace; font-size: 14px;">${id}</td>
              </tr>
              <tr>
                <td style="color: #64748B; font-weight: 600;">Entry PIN:</td>
                <td style="color: #059669; font-weight: 900; font-size: 16px; letter-spacing: 0.05em;">${entry_code}</td>
              </tr>
              <tr>
                <td style="color: #64748B; font-weight: 600;">Purpose:</td>
                <td style="color: #0F172A; font-weight: 700;">${purpose}</td>
              </tr>
              <tr>
                <td style="color: #64748B; font-weight: 600;">Host:</td>
                <td style="color: #0F172A; font-weight: 700;">${hostDisplay}</td>
              </tr>
              <tr>
                <td style="color: #64748B; font-weight: 600;">Vehicle:</td>
                <td style="color: #475569; font-weight: 600;">${vehicleDisplay}</td>
              </tr>
              <tr>
                <td style="color: #64748B; font-weight: 600;">Time:</td>
                <td style="color: #475569; font-weight: 600;">${timeDisplay}</td>
              </tr>
            </table>

            <!-- BUTTON -->
            <div align="center" style="margin: 26px 0 16px 0; text-align: center;">
              <a href="http://localhost:5173/gate" target="_blank" style="background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%); color: #FFFFFF; font-size: 13.5px; font-weight: 800; text-decoration: none; padding: 13px 32px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35); letter-spacing: 0.04em;">
                OPEN GUARD SECURITY PORTAL
              </a>
            </div>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td align="center" style="padding: 14px 24px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center;">
            <div style="font-size: 11px; color: #64748B;">
              AreneSHA Security Systems • Automated Dispatch to <strong style="color: #0F172A;">${targetRecipient}</strong>
            </div>
          </td>
        </tr>

      </table>

    </body>
    </html>
  `;

  const plainText = `AreneSHA Intelligent Security Checkpoint\nNEW VISITOR AUTHORIZATION SCHEDULED\nSecurity Notice for Guard (${targetRecipient}):\n\nVisitor Name: ${visitorDisplay}\nPass ID: ${id}\nEntry PIN: ${entry_code}\nPurpose: ${purpose}\nHost: ${hostDisplay}\nVehicle: ${vehicleDisplay}\nTime: ${timeDisplay}\n\nOPEN GUARD SECURITY PORTAL: http://localhost:5173/gate\n\nAreneSHA Security Systems • Automated Dispatch to ${targetRecipient}`;

  try {
    const mailOptions = {
      from: `"AreneSHA Security Alert" <${senderEmail}>`,
      to: targetRecipient,
      subject: `[GATE ALERT] New Visitor Scheduled: ${visitorDisplay} • PIN ${entry_code}`,
      html: htmlContent,
      text: plainText,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    };
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Dispatch] Guard Alert sent to ${targetRecipient} (MsgID: ${info.messageId})`);
    return { success: true, messageId: info.messageId, recipient: targetRecipient };
  } catch (err) {
    console.error('[Email Dispatch Error - Guard Alert]', err);
    return { success: false, error: err.message };
  }
}

