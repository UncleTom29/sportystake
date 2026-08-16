import urllib.request
import re

# Fetch one of AccessBET's JS files to find API endpoints
base_url = "https://accessbet.com"

# First get the page to find all JS files
req = urllib.request.Request("https://accessbet.com/sports", headers={
    "User-Agent": "Mozilla/5.0 Chrome/124"
})
with urllib.request.urlopen(req, timeout=15) as r:
    html = r.read().decode("utf-8", errors="replace")

# Find all versioned JS paths
js_files = re.findall(r'(/v[\d.]+/[^"\'<>?&\s]+\.js)', html)
print("JS files found:", js_files[:10])

# Check the sports subscribe function more carefully
ctx_start = html.find("sportsSubcribe")
if ctx_start >= 0:
    print("\nsportsSubscribe context:")
    print(html[ctx_start-200:ctx_start+600])

# Look for API calls in the main page
ctx_start = html.find("api/endpoint")
while ctx_start >= 0:
    print("\n/api/endpoint context:")
    print(html[max(0, ctx_start-100):ctx_start+300])
    ctx_start = html.find("api/endpoint", ctx_start+1)
    if ctx_start > 20000:
        break
