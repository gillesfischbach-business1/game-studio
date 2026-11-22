"""Stream a FLEURS dev tarball and keep a few short utterances (CC BY 4.0, Google).
Stops reading as soon as enough clips are found, so the full tarball is not downloaded."""
import sys, os, csv, io, tarfile, urllib.request, json
lang, n_keep, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
os.makedirs(out, exist_ok=True)
base = f'https://huggingface.co/datasets/google/fleurs/resolve/main/data/{lang}'
tsv = urllib.request.urlopen(f'{base}/dev.tsv', timeout=60).read().decode()
rows = {}
for r in csv.reader(io.StringIO(tsv), delimiter='\t', quoting=csv.QUOTE_NONE):
    if len(r) > 3:
        rows[r[1]] = r[2]
# kurze, alltägliche Sätze bevorzugen (keine Zahlen, nicht zu lang)
ok = {k: v for k, v in rows.items() if 25 <= len(v) <= 75 and not any(c.isdigit() for c in v)}
print(lang, 'candidates', len(ok), file=sys.stderr)
kept, meta = 0, []
resp = urllib.request.urlopen(f'{base}/audio/dev.tar.gz', timeout=120)
with tarfile.open(fileobj=resp, mode='r|gz') as tf:
    for m in tf:
        name = os.path.basename(m.name)
        if not m.isfile() or name not in ok:
            continue
        data = tf.extractfile(m).read()
        fn = f'{lang}_{kept:02d}.wav'
        open(os.path.join(out, fn), 'wb').write(data)
        meta.append({'file': fn, 'text': ok[name], 'src': f'google/fleurs {lang}/dev/{name}'})
        kept += 1
        print(fn, ok[name], file=sys.stderr)
        if kept >= n_keep:
            break
json.dump(meta, open(os.path.join(out, f'{lang}.json'), 'w'), ensure_ascii=False, indent=1)
