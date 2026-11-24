"""Stage edited release files over the verified original ASAR, preserving all other members."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
def sha(data): return hashlib.sha256(data).hexdigest()

def unpack_header(raw):
    a,b,c,d = struct.unpack_from('<4I', raw)
    if a != 4 or b != c+4 or c < d+4 or c % 4:
        raise ValueError('Invalid original ASAR framing')
    return json.loads(raw[16:16+d]), b+8, raw[16:16+d]

def files(tree, parent=''):
    for name, meta in tree['files'].items():
        path = parent + name
        if 'files' in meta:
            yield from files(meta, path+'/')
        elif 'offset' in meta and not meta.get('unpacked') and 'link' not in meta:
            yield path, meta

def pack(raw, changes):
    tree, body, old_header = unpack_header(raw)
    entries = sorted(files(tree), key=lambda row: int(row[1]['offset']))
    if not set(changes).issubset(path for path, _ in entries):
        raise ValueError('Only existing, packed ASAR members can be edited')
    result = bytearray()
    for path, meta in entries:
        old_offset = int(meta['offset'])
        old_size = meta['size']
        old_bytes = raw[body+old_offset:body+old_offset+old_size]
        if len(old_bytes) != old_size or (meta.get('integrity') and sha(old_bytes) != meta['integrity']['hash']):
            raise ValueError('Invalid original payload: '+path)
        payload = changes.get(path, old_bytes)
        if payload != old_bytes:
            integrity = meta['integrity']
            if integrity['algorithm'] != 'SHA256':
                raise ValueError('Unexpected original integrity algorithm')
            block = integrity['blockSize']
            integrity['hash'] = sha(payload)
            integrity['blocks'] = [sha(payload[i:i+block]) for i in range(0,len(payload),block)] or [sha(b'')]
            meta['size'] = len(payload)
        meta['offset'] = str(len(result))
        result.extend(payload)
    if not changes:
        return raw, sha(old_header), sha(old_header)
    h = json.dumps(tree,ensure_ascii=False,separators=(',',':')).encode()
    padding = b'\0' * (-len(h)%4)
    c = 4+len(h)+len(padding)
    rebuilt = struct.pack('<4I',4,c+4,c,len(h)) + h + padding + result
    return rebuilt, sha(old_header), sha(h)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('baseline_zip',type=Path)
    parser.add_argument('output_asar',type=Path)
    args = parser.parse_args()
    with ZipFile(args.baseline_zip) as z:
        original = z.read('resources/app.asar')
        manifest = json.loads(z.read('manifest.json'))
    if sha(original) != next(m['newSha256'] for m in manifest['replacements'] if m['path']=='resources/app.asar') or sha(original) != '33a260706204f42e0e029fd5c5b8e1b4a6b3cd4b47aa814d7380658c2a6dace0':
        raise ValueError('Baseline release hash does not match')
    tracked = {path: digest for digest,path in (line.split('  ',1) for line in (HERE/'deployed.sha256').read_text().splitlines())}
    present = {str(p.relative_to(HERE)) for p in (HERE/'release').rglob('*') if p.is_file()}
    if present != set(tracked):
        raise ValueError('Unexpected file addition or deletion under release/')
    modified = {}
    for path, digest in tracked.items():
        data = (HERE/path).read_bytes()
        if sha(data) == digest:
            continue
        member = path.removeprefix('release/')
        if not member.startswith('out/') or Path(member).suffix not in ('.js','.cjs','.html','.css'):
            raise ValueError('Unexpected edit outside of application text files: '+path)
        modified[member] = data
    candidate, old_h, new_h = pack(original, modified)
    with args.output_asar.open('xb') as f:
        f.write(candidate)
    print(json.dumps({'changed':list(modified),'baselineHeaderSha256':old_h,'candidateHeaderSha256':new_h,'candidateAsarSha256':sha(candidate)},indent=2))

if __name__=='__main__':
    main()
