import socket
import ipaddress
import logging
from urllib.parse import urlparse
from typing import Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup
from app.config import settings

logger = logging.getLogger(__name__)

# Disallowed IP ranges for SSRF prevention
BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),         # Loopback
    ipaddress.ip_network("10.0.0.0/8"),          # RFC 1918 Private
    ipaddress.ip_network("172.16.0.0/12"),       # RFC 1918 Private
    ipaddress.ip_network("192.168.0.0/16"),      # RFC 1918 Private
    ipaddress.ip_network("169.254.0.0/16"),      # Link-local / Cloud metadata (AWS, GCP, Azure)
    ipaddress.ip_network("0.0.0.0/8"),           # Current network
    ipaddress.ip_network("100.64.0.0/10"),       # Carrier-grade NAT
    ipaddress.ip_network("192.0.0.0/24"),        # IETF Protocol Assignments
    ipaddress.ip_network("192.0.2.0/24"),        # TEST-NET-1
    ipaddress.ip_network("198.51.100.0/24"),     # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),      # TEST-NET-3
    ipaddress.ip_network("224.0.0.0/4"),         # Multicast
    ipaddress.ip_network("240.0.0.0/4"),         # Reserved
    ipaddress.ip_network("::1/128"),             # IPv6 Loopback
    ipaddress.ip_network("fc00::/7"),            # IPv6 Unique Local
    ipaddress.ip_network("fe80::/10"),           # IPv6 Link-Local
]

def is_ip_allowed(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False
        for net in BLOCKED_NETWORKS:
            if ip in net:
                return False
        return True
    except ValueError:
        return False

def validate_url_and_resolve(url: str) -> Optional[str]:
    """
    Validates URL scheme and resolves hostname to ensure it does not point
    to private/internal IP ranges (SSRF prevention).
    Returns resolved IP if allowed, otherwise raises ValueError.
    """
    parsed = urlparse(url)
    if parsed.scheme.lower() not in ("http", "https"):
        raise ValueError(f"Unsupported URL scheme: {parsed.scheme}. Only HTTP and HTTPS are allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL: missing hostname.")

    # Block typical internal hostname patterns
    lower_host = hostname.lower()
    if lower_host in ("localhost", "metadata.google.internal", "instance-data"):
        raise ValueError("Access to internal hostnames is prohibited.")

    try:
        # Resolve hostname to IP addresses
        addr_info = socket.getaddrinfo(hostname, None)
        if not addr_info:
            raise ValueError(f"Could not resolve hostname: {hostname}")
        
        for item in addr_info:
            ip_str = item[4][0]
            if not is_ip_allowed(ip_str):
                raise ValueError(f"Target IP {ip_str} is within a restricted or private network.")

        return addr_info[0][4][0]
    except socket.gaierror as e:
        raise ValueError(f"DNS lookup failure for host '{hostname}': {e}")

class URLService:
    def analyze_url(self, raw_url: str) -> Dict[str, Any]:
        """
        Safely inspects a URL, follows redirects safely with SSRF protection,
        and extracts page title, meta description, visible text snippet, and structure.
        """
        url = (raw_url or "").strip()
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url

        result: Dict[str, Any] = {
            "requested_url": raw_url,
            "final_url": url,
            "scheme": "",
            "hostname": "",
            "path": "",
            "tld": "",
            "redirect_history": [],
            "status_code": None,
            "title": "",
            "meta_description": "",
            "text_snippet": "",
            "is_reachable": False,
            "error": None,
            "has_ssl": False
        }

        try:
            parsed = urlparse(url)
            result["scheme"] = parsed.scheme
            result["hostname"] = parsed.hostname or ""
            result["path"] = parsed.path or "/"
            result["has_ssl"] = parsed.scheme.lower() == "https"

            if parsed.hostname:
                parts = parsed.hostname.split(".")
                if len(parts) > 1:
                    result["tld"] = parts[-1]

            # SSRF check on initial URL
            validate_url_and_resolve(url)

            # Perform safe HTTP request
            current_url = url
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 PaylumeSecurityScanner/1.0"
            }

            max_redirects = 5
            redirect_count = 0

            with httpx.Client(
                timeout=settings.URL_REQUEST_TIMEOUT_SECONDS,
                follow_redirects=False,
                verify=True
            ) as client:
                while redirect_count <= max_redirects:
                    # Validate URL before each hop
                    validate_url_and_resolve(current_url)

                    resp = client.get(current_url, headers=headers)
                    result["status_code"] = resp.status_code

                    # Check for redirect
                    if resp.is_redirect and "location" in resp.headers:
                        redirect_count += 1
                        next_url = str(resp.next_request.url) if resp.next_request else resp.headers["location"]
                        result["redirect_history"].append({
                            "from": current_url,
                            "to": next_url,
                            "status": resp.status_code
                        })
                        current_url = next_url
                        continue
                    
                    # Reached final response
                    result["final_url"] = str(resp.url)
                    result["is_reachable"] = True

                    # Check content size
                    content = resp.content[:settings.MAX_URL_CONTENT_BYTES]
                    
                    # Parse HTML
                    content_type = resp.headers.get("content-type", "").lower()
                    if "text/html" in content_type or "application/xhtml" in content_type or b"<html" in content[:500].lower():
                        soup = BeautifulSoup(content, "html.parser")

                        # Remove script and style elements
                        for tag in soup(["script", "style", "noscript", "svg"]):
                            tag.decompose()

                        # Extract Title
                        if soup.title and soup.title.string:
                            result["title"] = soup.title.string.strip()

                        # Extract meta description
                        meta_desc = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
                        if meta_desc and meta_desc.get("content"):
                            result["meta_description"] = meta_desc["content"].strip()

                        # Extract visible text snippet
                        text = soup.get_text(separator=" ", strip=True)
                        # Clean multiple spaces
                        clean_text = " ".join(text.split())
                        result["text_snippet"] = clean_text[:800]
                    else:
                        result["text_snippet"] = f"[Non-HTML content: {content_type}, length: {len(content)} bytes]"
                    break

        except ValueError as ve:
            logger.warning(f"URL validation/SSRF blocked for '{url}': {ve}")
            result["error"] = str(ve)
        except httpx.RequestError as re:
            logger.info(f"Network request error analyzing URL '{url}': {re}")
            result["error"] = f"Could not reach destination: {type(re).__name__}"
        except Exception as e:
            logger.warning(f"Unexpected error analyzing URL '{url}': {e}")
            result["error"] = str(e)

        return result

url_service = URLService()
