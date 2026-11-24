"""Extract current portable AIA text/assets from exact verified shipped release."""
from pathlib import Path
from zipfile import ZipFile
import runpy
r=Path(__file__).resolve().parent
pack=runpy.run_path(str(r/'ref/aia-recovered/stage.py'))
sha=pack['sha']
source=r/'AIA-Desktop-Two-Toggles-Update.zip'
assert sha(source.read_bytes())=='f29d220b5ee8d8a36be6735bb9a86242000032aead00bcb7d4cbf9ebf69f94cc'
with ZipFile(source) as z: raw=z.read('resources/app.asar')
tree, body, header=pack['unpack_header'](raw)
assert sha(raw)=='a837741b0f46a5ac9382d002bc39fa5ca3d26675fd4b3205b7c4d5dde09237c4'
assert sha(header)=='87f4feb100f4c24e4f6e7e568073b4530e41403b54442468247d411386fc5f17'
base=r/'base'
base.mkdir()
for n,x in pack['files'](tree):
 if n.startswith('out/') or n=='package.json':
  j=int(x['offset'])+body
  value=raw[j:j+x['size']]
  assert not x.get('integrity') or sha(value)==x['integrity']['hash']
  p=base/n
  p.parent.mkdir(parents=True,exist_ok=True)
  p.write_bytes(value)
