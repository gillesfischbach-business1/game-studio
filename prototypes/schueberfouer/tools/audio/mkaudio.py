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


O = SRC + '/oga/'
M = {}
# --- Menschenmenge (Betten, laufen immer) ---
save('crowd_murmur', loop(O + 'crowd_-_mall_ambience.mp3', 6, 30, rms=0.16))
save('crowd_busy', loop(O + 'crowd_shouting_0.ogg', 1, 24, rms=0.16))
save('crowd_cheer', loop(O + 'crowd_-_cheering_-_soft_cheering_and_chatter.mp3', 3, 30, rms=0.16))
# --- Musik an den Fahrgeschäften (Lautsprecher) ---
save('mus_groove', loop(O + '_cant_resist_the_groove.wav', 20, 48), 80)
save('mus_layers', loop(O + 'twin_layers.wav', 30, 48), 80)
save('mus_celeb', loop(O + 'the_celebrity.wav', 12, 44), 80)
save('mus_dance', loop(O + 'silent_dance_floor.wav', 16, 44), 80)
save('mus_house', loop(O + 'Of Far Different Nature - Funky House (CC0)_0.mp3', 8, 44), 80)
save('mus_polka', loop(O + 'Bruno_Belotti_-_La_Spensierata__Polka_Loop.ogg', 0, 48), 80)
save('mus_choro', loop(O + 'MSTR_-_MSTR_-_Choro_bavario_Loop.ogg', 0, 60, xf=0), 80)
save('mus_organ', loop(O + 'carnivalrides.ogg', 0, 23.5, xf=1.5), 80)
# --- Restaurants / Küche / Wetter / Feuerwerk ---
save('kitchen', loop(O + 'cookware_clatter.wav', 10, 18, rms=0.12))
save('rain_roof', loop(O + 'rain_-_falling_on_a_metal_roof.mp3', 4, 20, rms=0.14))
save('fireworks', oneshot(O + 'fireworks_-_new_years_eve.mp3', 40, 45, fade=1.5), 72)
# --- Ansagen (Jahrmarkt-Ausrufer) ---
save('barker1', oneshot(O + 'Budikopf.wav'))
save('barker2', oneshot(O + 'Reisenmeerschweineishorn.wav'))
# --- kurze Effekte als Sprites ---
M['glass'] = sprite('glass', [O + 'z1/glass_0%d.ogg' % i for i in range(1, 6)] + [O + 'z2/sfx100v2_glass_0%d.ogg' % i for i in range(1, 7)])
M['dishes'] = sprite('dishes', [O + 'z1/dishes_0%d.ogg' % i for i in range(1, 5)])
M['shot'] = sprite('shot', [O + 'z1/shot_01.ogg', O + 'z1/shot_02.ogg'])
json.dump(M, open(os.path.join(OUT, 'sprites.json'), 'w'))
print('sprites', M)

# --- Gesprächsfetzen (FLEURS, CC BY 4.0) + Lachen (CC0) ---
if os.environ.get('VOICES'):
    V = SRC + '/'
    picks = ['voices_lb/lb_lu_05', 'voices_lb/lb_lu_08', 'voices_lb/lb_lu_11', 'voices_lb/lb_lu_03',
             'voices_lb/lb_lu_19', 'voices_lb/lb_lu_20', 'voices/fr_fr_01', 'voices/fr_fr_07', 'voices/de_de_00',
             'voices/de_de_04', 'voices/de_de_07', 'voices/pt_br_03', 'voices/pt_br_07']
    tmpd = os.path.join(OUT, '_v'); os.makedirs(tmpd, exist_ok=True)
    files = []
    for p in picks:
        o = os.path.join(tmpd, os.path.basename(p) + '.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', V + p + '.wav', '-af',
                        'highpass=f=120,silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',
                        o], check=True)
        files.append(o)
    M2 = json.load(open(os.path.join(OUT, 'sprites.json')))
    M2['voices'] = sprite('voices', files, 0.3)
    M2['giggle'] = sprite('giggle', [O + 'group_giggling.ogg'])
    json.dump(M2, open(os.path.join(OUT, 'sprites.json'), 'w'))
    for f in files: os.remove(f)
    os.rmdir(tmpd)
    print('voices', M2['voices'])
