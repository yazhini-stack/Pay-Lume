# CERT-In Advisory: Modus Operandi of Fake Payment Requests and Instant Gateway Fraud

## Threat Summary
The Indian Computer Emergency Response Team (CERT-In) and international cyber defense agencies issue frequent advisories regarding payment request fraud on digital payment interfaces (UPI, IMPS, instant bank wires, and debit cards).

## Core Attack Techniques
1. **"Collect Request" Deception (Debit Masquerading as Credit)**: Attackers tell sellers on online platforms: "I want to purchase your item. I am sending you a payment via UPI/payment app. Just approve the notification or enter your UPI PIN to receive the money."
   - **GOLDEN SECURITY RULE: You NEVER enter your PIN, password, or biometric authorization to RECEIVE money.** Entering a PIN always authorizes money to be DEBITED from your account.
2. **Remote Desktop Application Coercion**: Scammers posing as bank tech support or telecom customer service persuade victims to download screen-sharing utilities (AnyDesk, TeamViewer, RustDesk) under the guise of resolving a failed transaction. The attacker then views the user's screen while they enter bank credentials or captures SMS OTP tokens.
3. **Fake Transaction Receipts and Spoofed SMS**: Attackers generate spoofed screenshots of successful bank transfers to convince victims that goods can be released.
4. **Lottery and Cashback Impersonation**: Scratch cards or unexpected cashback notifications requiring payment of an upfront "processing fee" or "GST registration fee" before receiving the prize.

## Safe Handling Checklist
- Verify incoming payments inside your authentic banking app statement rather than trusting third-party screenshots or unverified SMS alerts.
- Never grant screen-sharing permissions to unknown callers.
- Immediately freeze or block bank accounts and payment cards through your bank's emergency helpline if suspicious unauthorized debits occur.
