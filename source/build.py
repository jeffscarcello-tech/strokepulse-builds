#!/usr/bin/env python3
"""Builds dist/app.json + dist/build.txt for the StrokePulse auto-updater."""
import json, base64, subprocess, os, re, sys
here = os.path.dirname(os.path.abspath(__file__)); out = os.path.join(here, '..', 'dist'); os.makedirs(out, exist_ok=True)
v = json.load(open(os.path.join(here, 'version.json')))
build, label = v['build'], v['label']
assert re.fullmatch(r'[A-Za-z0-9._-]{3,40}', build), 'bad build name'
assert "'" not in label and '"' not in label, 'no quotes in label'
sub = lambda t: t.replace('__BUILD__', build).replace('__LABEL__', label)
html = sub(open(os.path.join(here, 'index.html')).read())
sw = sub(open(os.path.join(here, 'sw.js')).read())
svg = open(os.path.join(here, 'icon.svg')).read()
def png(size, square=False):
    src = svg.replace('rx="112" ', '') if square else svg
    r = subprocess.run(['rsvg-convert', '-w', str(size), '-h', str(size)], input=src.encode(), capture_output=True, check=True)
    return base64.b64encode(r.stdout).decode()
manifest = json.dumps({ 'name': 'StrokePulse', 'short_name': 'StrokePulse', 'start_url': '/', 'scope': '/', 'display': 'standalone',
  'orientation': 'portrait', 'background_color': '#05070a', 'theme_color': '#05070a',
  'icons': [ {'src': f'/icon-192.png?v={build}', 'sizes': '192x192', 'type': 'image/png'},
             {'src': f'/icon-512.png?v={build}', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'} ] })
assert '__BUILD__' not in html and '__LABEL__' not in html
app = { 'app': 'strokepulse', 'build': build, 'label': label, 'html': html, 'sw': sw, 'manifest': manifest, 'icon_svg': svg,
        'i192': png(192), 'i512': png(512, True), 'apple': png(180, True),
        'files': { '/cox.js': { 'type': 'application/javascript; charset=utf-8', 'b64': base64.b64encode(sub(open(os.path.join(here, 'cox.js')).read()).encode()).decode() } } }
json.dump(app, open(os.path.join(out, 'app.json'), 'w'))
open(os.path.join(out, 'build.txt'), 'w').write(build + '\n')
print('built', build, label, len(json.dumps(app)), 'bytes')
