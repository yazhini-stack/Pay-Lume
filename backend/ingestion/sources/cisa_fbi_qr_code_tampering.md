# CISA / FBI Cyber Alert: Malicious QR Codes (Quishing) and Physical Sticker Tampering

## Overview
Quick Response (QR) codes are two-dimensional barcodes that encode textual data, most commonly web addresses (URLs) or payment deep-links. Cybercriminals increasingly leverage malicious QR codes—often termed "quishing" (QR phishing)—to direct unsuspecting victims to credential-harvesting phishing portals or malicious payment payment processors.

## Physical Tampering and Attack Vectors
1. **Parking Meter and Public Kiosk Sticker Overlays**: Attackers paste physical stickers featuring malicious QR codes directly over legitimate parking meters, public transit ticketing kiosks, restaurant menus, or city payment portals. Scanning the sticker directs users to a fraudulent payment gateway that captures credit card numbers.
2. **Email and PDF Quishing**: Traditional email security gateways frequently inspect hyperlinks and text within email bodies, but often cannot evaluate embedded images containing QR codes. Fraudsters exploit this blind spot by placing QR codes in PDF invoices or email graphics directing users to fake MFA or Microsoft 365 login portals.
3. **Deceptive Intent via Visual Masking**: Because humans cannot read encoded QR matrix patterns with the naked eye, the destination URL is completely concealed until after the code is scanned by a camera.

## Critical Safety Guidance
- **Inspect Physical Integrity**: Before scanning a QR code at a parking meter, gas pump, or outdoor station, check if a sticker has been pasted over the original surface. If peeling or misalignment is evident, do not scan it.
- **Inspect Preview URL Before Visiting**: Modern smartphone cameras display a preview of the decoded web address before opening the browser. Scrutinize the hostname and domain carefully.
- **Never Download Apps via QR Codes**: If a QR code prompts you to install an unfamiliar app or APK directly from an external browser rather than official app stores (Apple App Store or Google Play), cancel immediately.
- **Do Not Authorize Payments Blindly**: When a QR code initiates a digital wallet or payment app, verify the recipient merchant name and the exact requested sum on your banking app screen before entering any PIN or fingerprint authorization.
