"""Turn downloaded CC0 / CC-BY(-SA) recordings into compact game audio.
Loops get a baked crossfade so they repeat without a click.
Output: mono MP3 (universal browser + Android WebView support)."""
import subprocess, wave, os, sys, json
import numpy as np

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'snd')
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
SR = 32000


def load(path, start=0.0, dur=None):
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(start), '-i', path]
    if dur: cmd += ['-t', str(dur)]
    cmd += ['-ac', '1', '-ar', str(SR), '-f', 's16le', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def save(name, x, kbps=64):
    x = np.clip(x, -1, 1)
    tmp = os.path.join(OUT, name + '.tmp.wav')
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
    out = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', out], check=True)
    os.remove(tmp)
    print(f'{name:16s} {len(x)/SR:6.1f}s {os.path.getsize(out)//1024:5d} KB')


def norm(x, peak=0.89, rms=None):
    if rms:
        r = np.sqrt(np.mean(x ** 2)) + 1e-9
        x = x * (rms / r)
    p = np.max(np.abs(x)) + 1e-9
    return x * min(1.0, peak / p) if rms else x * (peak / p)


def loop(path, start, length, xf=2.0, rms=None):
    """Seamless loop: the tail after `length` is crossfaded into the head."""
    x = load(path, start, length + xf)
    if xf == 0 or len(x) < int((length + xf) * SR) - 10:   # schon als Loop gebaut: unverändert
        return norm(x[:int(length * SR)] if xf else x, rms=rms) if rms else norm(x)
    L, X = int(length * SR), int(xf * SR)
    x = x[:L + X]
    head, tail = x[:X].copy(), x[L:L + X]
    t = np.linspace(0, 1, X)
    fade_in, fade_out = np.sin(t * np.pi / 2), np.cos(t * np.pi / 2)  # equal power
    x = x[:L].copy()
    x[:X] = head * fade_in + tail * fade_out
    return norm(x, rms=rms) if rms else norm(x)


def oneshot(path, start=0.0, dur=None, fade=0.05):
    x = load(path, start, dur)
    F = int(fade * SR)
    if len(x) > 2 * F:
        x[:F] *= np.linspace(0, 1, F); x[-F:] *= np.linspace(1, 0, F)
    return norm(x)


def sprite(name, files, gap=0.3):
    """Several short clips in one file; offsets go to a JSON map."""
    parts, offs, pos = [], [], 0.0
    pad = np.zeros(int(gap * SR), np.float32)
    for f in files:
        c = norm(load(f), 0.9)
        parts += [pad, c]; pos += gap
        offs.append([round(pos, 3), round(len(c) / SR, 3)]); pos += len(c) / SR
    parts.append(pad)
    save(name, np.concatenate(parts), 64)
    return offs



# --- v0.6: Blosmusek, Schreie, starker Jubel, Motorbrummen ---
P = SRC + '/oga2/'
M = json.load(open(os.path.join(OUT, 'sprites.json')))
save('mus_march', loop(P + 'march_1.ogg', float(os.environ.get('MARCH_START', '8')), 56), 80)
C = P + 'cheer/Gregor Quendel - Free Crowd Cheering Sounds - MP3/Gregor Quendel - Crowd Cheering Sounds - '
save('crowd_cheer', loop(C + '03 - Strong cheering - I.mp3', 1, 21, rms=0.16))
save('motor', loop(P + 'loop_generator_1.mp3', 0.2, 4.6, xf=0.6, rms=0.14), 56)
M['scream'] = sprite('scream', [P + 'female_screams/%d.ogg' % i for i in (1, 2, 3, 4)] + [P + 'aargh/aargh%d.ogg' % i for i in (5, 6)])
json.dump(M, open(os.path.join(OUT, 'sprites.json'), 'w'))
print(M['scream'])
