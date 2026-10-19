#!/bin/sh
# Speak Easy test suite. Fails loudly on the first problem.
set -e
cd "$(dirname "$0")/.."

echo "== build =="
node scripts/build.js

echo "== syntax =="
node --check dist/worker.js
node --check src/frontend/app.js
node --check scripts/build.js

echo "== phrases.json =="
python3 -c "
import json
data = json.load(open('src/frontend/phrases.json'))
assert data['packs'], 'no packs'
n = 0
for pack in data['packs']:
    assert pack['id'] and pack['title'] and pack['phrases'], pack
    for p in pack['phrases']:
        assert p.get('es') and p.get('en') and p.get('phonetic'), p
        n += 1
print(f'{len(data[\"packs\"])} packs, {n} phrases ok')
"

echo "== spec fields =="
python3 -c "
import glob
for f in glob.glob('.openspec/specs/*.spec.yaml'):
    text = open(f).read()
    for field in ['title:', 'description:', 'acceptance_criteria:', 'test_plan:', 'status:']:
        assert field in text, f'{f} missing {field}'
    print('ok', f)
"

echo "== smoke test =="
node scripts/smoke-test.js

echo "== no secrets or leftover placeholders =="
# Scans shipped code and docs. The openspec templates directory intentionally
# carries placeholder tokens and specs may discuss placeholders; both excluded.
# scripts/smoke-test.js is excluded: its "passwords" are random per run or
# intentionally wrong, never real credentials.
if grep -rniE 'password\s*[:=]\s*["'\''][^"'\'']+["'\'']|api[_-]?key\s*[:=]|bearer [A-Za-z0-9._-]{10,}' \
    --include='*.js' --include='*.json' --include='*.yaml' --include='*.md' --include='*.html' --include='*.css' \
    --exclude='smoke-test.js' \
    src scripts README.md CHANGELOG.md 2>/dev/null | grep -v 'APP_PASSWORD' | grep -viE 'contrase.a|password lives|\"password\"'; then
  echo "possible secret found above"
  exit 1
fi
if grep -rn '{{[A-Z_]\+}}' src scripts README.md CHANGELOG.md 2>/dev/null; then
  echo "unfilled placeholder found above"
  exit 1
fi

echo "all checks passed"
