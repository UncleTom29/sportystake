import urllib.request
import re

# Fetch AccessBET HTML
req = urllib.request.Request("https://accessbet.com/sports", headers={
    "User-Agent": "Mozilla/5.0 Chrome/124",
    "Cookie": ""
})
with urllib.request.urlopen(req, timeout=15) as r:
    html = r.read().decode("utf-8", errors="replace")

print("Page size:", len(html))

# Find API paths
apis = re.findall(r'["\']/(api/[^"\'<>?&\s]{2,60})["\']', html)
for a in sorted(set(apis)):
    print("API:", a)

# Find script tags
scripts = re.findall(r'src=["\']([^"\']+\.js[^"\']*)["\']', html)
for s in scripts[:10]:
    print("Script:", s)

# Look for keywords
for kw in ["prematch", "events", "sports", "football", "soccer", "odds", "fixtures"]:
    hits = [m.start() for m in re.finditer(kw, html, re.IGNORECASE)]
    if hits:
        print(f"Keyword '{kw}' at positions: {hits[:3]} - context: {html[hits[0]-20:hits[0]+60]!r}")
