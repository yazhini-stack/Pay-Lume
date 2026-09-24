# OWASP Security Reference: Deceptive Domains, Malicious URLs, and SSL/TLS Misconceptions

## Common Deceptive URL Tactics
1. **Typosquatting and Lookalike Domains**: Attackers register domain names intentionally misspelled (e.g., `amazn-security.com`, `paypa1.com`, `bankofarnenca.com`). They mimic brand styling to harvest credentials.
2. **Subdomain Pretexting**: Attackers prepend trusted brand names as subdomains of an attacker-controlled root domain (e.g., `chase.com.security-verification-portal.net`). Non-technical users notice "chase.com" at the beginning of the string, failing to realize the effective registrar domain is actually `security-verification-portal.net`.
3. **Open Redirect Abuse**: Exploiting legitimate websites that do not validate redirect destinations, making a malicious link look like it starts on a trustworthy domain (e.g., `trusted-site.com/redirect?to=https://malicious-site.xyz`).
4. **URL Shorteners**: Attackers use link shorteners (bit.ly, tinyurl, t.co) to obscure deceptive paths and bypass automated domain reputation filters.

## The Critical "Padlock / HTTPS" Misconception
- A padlock icon or `https://` prefix ONLY guarantees that traffic between your web browser and the destination server is encrypted.
- **HTTPS DOES NOT PROVE THAT A WEBSITE IS LEGITIMATE OR SAFE.**
- Free automated certificate authorities (such as Let's Encrypt) issue valid SSL/TLS certificates to anyone controlling a domain name within seconds. More than 80% of modern phishing websites operate over valid HTTPS connections.

## Objective Verification Methodology
- Always read domain names from right to left: identify the Top-Level Domain (.com, .org, .gov) and the immediately preceding root domain name.
- Do not assume an unusual TLD (.xyz, .top, .cc) is malicious automatically, but recognize that low-cost TLDs are statistically favored in disposable phishing campaigns.
- Check domain age via WHOIS databases: newly registered domains (less than 30-90 days old) impersonating established brands are overwhelmingly fraudulent.
