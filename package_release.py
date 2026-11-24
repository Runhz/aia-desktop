"""Create a deterministic format-3 update from a verified installed AIA release."""
from pathlib import Path
import hashlib, json, runpy, sys, zipfile
root=Path(__file__).resolve().parent
source=root/"AIA-Desktop-Two-Toggles-Update.zip"
verify=runpy.run_path(str(root/"ref/aia-recovered/stage.py"))
sha=verify["sha"]
expected="f29d220b5ee8d8a36be6735bb9a86242000032aead00bcb7d4cbf9ebf69f94cc"
if sha(source.read_bytes())!=expected: raise ValueError("Baseline zip mismatch")
with zipfile.ZipFile(source) as z:
 raw=z.read("resources/app.asar")
 previous=json.loads(z.read("manifest.json"))
if sha(raw)!=previous["newAsarSha256"]: raise ValueError("Baseline ASAR mismatch")
def read_members(payload):
 tree, offset, header=verify["unpack_header"](payload)
 members={}
 for name,d in verify["files"](tree):
  start=offset+int(d["offset"])
  value=payload[start:start+d["size"]]
  if len(value)!=d["size"] or d.get("integrity") and sha(value)!=d["integrity"]["hash"]:
   raise ValueError(f"Member SHA mismatch: {name}")
  members[name]=value
 return members,sha(header)
old,header=read_members(raw)
if header!=previous["newHeaderSha256"]: raise ValueError("Baseline header mismatch")
allowed={
    "out/main/index.js",
    "out/renderer/assets/trial-DGJV07EL.js",
    "out/renderer/assets/trial-CHpZpqOI.css",
    "out/renderer/assets/panel-BRyOr7Vn.js",
    "out/renderer/assets/math-message-CfGW1i5D.js",
}
assembly=Path(sys.argv[1])
changes={path:(assembly/path).read_bytes() for path in allowed}
for rel in (assembly/"out").rglob("*"):
 if not rel.is_file(): continue
 path=rel.relative_to(assembly).as_posix()
 if path not in old or path not in allowed and old[path]!=rel.read_bytes(): raise ValueError(f"Unexpected changed member {path}")
candidate,old_header,new_header=verify["pack"](raw,changes)
new,candidate_header=read_members(candidate)
changed=set(k for k,v in new.items() if v!=old[k])
assert changed==allowed and old.keys()==new.keys() and candidate_header==new_header and old_header==header
manifest={
 "format":3,
 "oldExeSha256":"f83b02168494c69024bbf98e754a627b2e3f45794fcd25acd2c253ceb1d5bf8d",
 "oldAsarSha256":sha(raw),
 "newAsarSha256":sha(candidate),
 "oldHeaderSha256":old_header,
 "newHeaderSha256":new_header,
 "asarSize":len(candidate),
 "changedMembers":sorted(changed),
 "preserve":previous["preserve"],
}
output=Path(sys.argv[2])
with zipfile.ZipFile(output,"x",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name,payload in (("manifest.json",json.dumps(manifest,ensure_ascii=False,indent=2).encode()+b'\n'),("resources/app.asar",candidate)):
  entry=zipfile.ZipInfo(name,date_time=(2026,11,23,0,0,0))
  z.writestr(entry,payload,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
with zipfile.ZipFile(output) as z: assert not z.testzip()
print(json.dumps({**manifest,"packageSha256":sha(output.read_bytes()),"packageBytes":output.stat().st_size},indent=2))
