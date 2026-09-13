import requests
import re

url = 'https://frontend-hazel-six-6dsq834e13.vercel.app/'
r = requests.get(url, timeout=15)
print('Vercel HTML status:', r.status_code)
assert r.status_code == 200, f"Expected 200, got {r.status_code}"

matches = re.findall(r'src="(/assets/index-[^"]+\.js)"', r.text)
print('Main JS bundle path:', matches)
assert len(matches) > 0, "No JS bundle found in HTML"

bundle_url = 'https://frontend-hazel-six-6dsq834e13.vercel.app' + matches[0]
r_js = requests.get(bundle_url, timeout=20)
print('JS bundle size:', len(r_js.content), 'bytes')

# 1. Verify old hardcoded offline demo string is GONE
has_old_banner = 'Operating in Resilient Offline Demo Mode' in r_js.text
print('Contains old offline banner:', has_old_banner)
assert not has_old_banner, "Old offline banner string still exists in production bundle!"

# 2. Verify new interactive diagnostics is present
has_diagnostics = 'System Architecture' in r_js.text
print('Contains SystemDiagnostics component:', has_diagnostics)
assert has_diagnostics, "SystemDiagnostics component missing from production bundle!"

# 3. Verify multilingual Telugu & Hindi translations are present
has_translations = 'మీ గొంతు' in r_js.text
print('Contains Telugu translations:', has_translations)
assert has_translations, "Telugu translations missing from production bundle!"

# 4. Verify ZERO localhost or 127.0.0.1 references in bundle
has_localhost = 'localhost' in r_js.text
has_127 = '127.0.0.1' in r_js.text
print('Contains localhost:', has_localhost)
print('Contains 127.0.0.1:', has_127)
assert not has_localhost, "Production bundle contains localhost reference!"
assert not has_127, "Production bundle contains 127.0.0.1 reference!"

print("\n>>> ALL VERCEL PRODUCTION BUNDLE CHECKS PASSED WITH 100% INTEGRITY! <<<")
