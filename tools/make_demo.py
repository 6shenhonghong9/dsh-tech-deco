# -*- coding: utf-8 -*-
"""生成 dsh-tech-deco 效果预览图（浅色 / 深色）与进入动画 GIF。

要点：所有半透明绘制先画在独立透明层，再 alpha_composite 回画布，
否则 ImageDraw 在 RGBA 上是「覆盖」语义，convert('RGB') 会把半透明变成纯色。
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "demo")
os.makedirs(OUT, exist_ok=True)

W, H = 1200, 750
MONO = "C:/Windows/Fonts/consola.ttf"
CJK = "C:/Windows/Fonts/msyh.ttc"
ACCENT = (255, 117, 0)


def font(path, size):
    return ImageFont.truetype(path, size)


F_CAP = font(MONO, 9)
F_TINY = font(MONO, 8)
F_SM = font(MONO, 10)
F_ZH = font(CJK, 13)
F_ZH_S = font(CJK, 12)
F_STATUS = font(CJK, 9)


def pal(dark):
    return {
        "bg": (11, 11, 12) if dark else (229, 227, 223),
        "bg2": (19, 19, 21) if dark else (236, 234, 230),
        "ink": (242, 241, 238) if dark else (10, 10, 10),
        "soft": (207, 206, 203) if dark else (58, 57, 54),
        "muted": (133, 132, 127) if dark else (122, 120, 115),
        "panel": (16, 16, 18) if dark else (238, 236, 232),
        "card": (26, 26, 29, 215) if dark else (255, 255, 255, 150),
    }


def layer(img, fn):
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    fn(ImageDraw.Draw(ov, "RGBA"))
    return Image.alpha_composite(img, ov)


def new_canvas(dark):
    p = pal(dark)
    img = Image.new("RGBA", (W, H), p["bg2"] + (255,))
    d = ImageDraw.Draw(img, "RGBA")
    for y in range(0, H, 2):
        k = min(1.0, y / (H * 0.45))
        c = tuple(int(p["bg2"][i] * (1 - k) + p["bg"][i] * k) for i in range(3)) + (255,)
        d.rectangle([0, y, W, y + 1], fill=c)

    def paint(dd):
        for x in range(0, W, 34):
            for y in range(0, H, 34):
                big = (x % 136 == 0 and y % 136 == 0)
                s = 2 if big else 1
                a = (44 if big else 18) if dark else (34 if big else 14)
                dd.rectangle([x, y, x + s - 1, y + s - 1],
                             fill=(255, 255, 255, a) if dark else (10, 10, 10, a))
        for i, (cx, bw) in enumerate([(0.70, 0.10), (0.86, 0.14)]):
            x0 = int(cx * W)
            bwid = int(bw * W)
            for y in range(-120, H, 474):
                dd.rectangle([x0, y, x0 + bwid, y + 460],
                             fill=(255, 255, 255, 12) if dark else (255, 255, 255, 85))
                dd.line([x0, y, x0 + bwid, y],
                        fill=(255, 255, 255, 26) if dark else (255, 255, 255, 190))

    return layer(img, paint), p


def draw_ring(img, p, intro):
    cx, cy = int(W * 0.42), int(H * 0.44)
    R = 150 * (min(W, H) * 0.21 / 150) * (0.12 + 0.88 * intro)
    a = 0.35 + 0.65 * intro
    ink, soft, muted = p["ink"], p["soft"], p["muted"]

    def paint(d):
        for m, wdt, al in ((2.05, 40, 5), (1.72, 26, 7), (1.40, 14, 6)):
            rr = R * m
            d.arc([cx - rr, cy - rr, cx + rr, cy + rr], 0, 360,
                  fill=(255, 150, 60, int(al * a)), width=wdt)
        d.arc([cx - R, cy - R, cx + R, cy + R], 215 - 90, 505 - 90,
              fill=ink + (int(190 * a),), width=max(3, int(R * 0.055)))
        ang = math.radians(505 - 90)
        ex, ey = cx + R * math.cos(ang), cy + R * math.sin(ang)
        d.ellipse([ex - R * 0.045, ey - R * 0.045, ex + R * 0.045, ey + R * 0.045],
                  fill=ink + (int(190 * a),))
        r2 = R * 0.62
        d.arc([cx - r2, cy - r2, cx + r2, cy + r2], 160, 430,
              fill=soft + (int(150 * a),), width=2)
        r3 = R * 0.42
        for s, e in ((60, 200), (240, 380)):
            d.arc([cx - r3, cy - r3, cx + r3, cy + r3], s, e,
                  fill=ink + (int(170 * a),), width=max(1, int(R * 0.014)))
        for i, m in enumerate((1.30, 1.66, 2.04)):
            rr = R * m
            d.arc([cx - rr, cy - rr, cx + rr, cy + rr], 0, 360,
                  fill=muted + (int((26 - i * 6) * a),), width=1)
        for dx, dy in ((-48, -68), (52, 68), (78, -50)):
            px, py = cx + dx * (R / 150), cy + dy * (R / 150)
            d.ellipse([px - 3, py - 3, px + 3, py + 3], fill=ACCENT + (int(200 * a),))

    return layer(img, paint)


def draw_sidebar(img, p):
    w = 330

    def paint(d):
        d.rectangle([0, 0, w, H], fill=p["panel"] + (255,))
        d.rectangle([10, 8, w - 10, H - 8], outline=ACCENT + (70,), width=1)
        d.line([w, 0, w, H], fill=ACCENT + (90,), width=1)
        d.text((22, 20), "NAV // SYSTEM", font=F_CAP, fill=ACCENT + (255,))
        d.line([16, 44, w - 16, 44], fill=ACCENT + (70,))
        d.text((22, 58), "● REV 0.1.0 · WEB PROFILE", font=F_TINY, fill=ACCENT + (255,))
        for i, name in enumerate(["插件", "任务看板", "智能体", "更多"]):
            y = 100 + i * 34
            if i == 0:
                d.rectangle([8, y - 6, w - 8, y + 24], fill=ACCENT + (26,), outline=ACCENT + (140,))
                d.rectangle([8, y - 6, 11, y + 24], fill=ACCENT + (255,))
            d.text((16, y + 2), "0" + str(i + 1), font=F_TINY, fill=p["muted"] + (255,))
            d.text((40, y), name, font=F_ZH, fill=p["ink"] + (255,))
        d.text((22, 262), "SESSIONS", font=F_CAP, fill=p["muted"] + (255,))
        rows = [("rhine-3f2a", "ACTIVE", True), ("kael-91c0", "IDLE", False),
                ("origin-07", "IDLE", False), ("archive-2b", "ARCH", False)]
        for i, (name, st, act) in enumerate(rows):
            y = 290 + i * 30
            d.rectangle([14, y + 6, 17, y + 20], fill=ACCENT + (255 if act else 80,))
            d.text((26, y + 2), name, font=F_SM, fill=p["ink"] + (255,))
            d.text((w - 78, y + 2), st, font=F_TINY,
                   fill=(ACCENT if act else p["muted"]) + (255,))
        d.line([16, H - 40, w - 16, H - 40], fill=ACCENT + (70,))
        d.text((22, H - 30), "OPS · 0087", font=F_TINY, fill=p["muted"] + (255,))
        for i, h in enumerate((5, 9, 6, 11)):
            x = w - 60 + i * 4
            d.rectangle([x, H - 41 + (11 - h), x + 2, H - 30], fill=ACCENT + (220,))

    return layer(img, paint)


def draw_frame(img, p):
    def paint(d):
        for (x, y, sx, sy) in ((12, 12, 1, 1), (W - 12, 12, -1, 1),
                               (12, H - 12, 1, -1), (W - 12, H - 12, -1, -1)):
            d.line([x, y, x + 20 * sx, y], fill=ACCENT + (150,), width=1)
            d.line([x, y, x, y + 20 * sy], fill=ACCENT + (150,), width=1)
        for y in (10, H - 12):
            for i in range(25):
                x = int(W * 0.30 + i * (W * 0.44) / 24)
                d.line([x, y, x, y + 6], fill=p["muted"] + (110,), width=1)
        d.text((W - 168, 96), "── BUILD 0.1.0", font=F_CAP, fill=p["muted"] + (230,))
        d.text((W - 168, 110), "── DECO · ACTIVE", font=F_CAP, fill=p["muted"] + (230,))
        d.text((W - 168, 124), "PROFILE : WEB", font=F_CAP, fill=p["muted"] + (230,))
        d.text((W - 168, 138), "REV 0.1.0 · DECO", font=F_TINY, fill=p["muted"] + (255,))
        d.text((W - 168, 152), "● SYS STATUS : ONLINE", font=F_TINY, fill=ACCENT + (255,))

    return layer(img, paint)


def draw_composer(img, p):
    x0, x1 = 380, W - 30
    y0, y1 = H - 150, H - 72

    def paint(d):
        d.rectangle([x0, y0, x1, y1], fill=p["card"], outline=ACCENT + (120,))
        for (x, y) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
            d.rectangle([x - 4, y - 4, x + 4, y + 4], fill=(255, 154, 60, 230))
        d.text((x0 + 12, y0 - 15), "// COMPOSER", font=F_CAP, fill=ACCENT + (255,))
        d.text((x0 + 14, y0 + 14), "发消息或创建任务，/ 调用指令，@ 文件或对话",
               font=F_ZH_S, fill=p["muted"] + (255,))
        d.text((x0 + 14, y1 - 26), "⊕   完全权限 ⌄    ☺", font=F_CAP, fill=p["soft"] + (255,))
        d.text((x1 - 168, y1 - 26), "DeepSeek-V4.1-Flash High ⌄", font=F_TINY,
               fill=p["muted"] + (255,))
        d.text((x0 + 8, y1 + 22), "▮▮▮ TELEMETRY", font=F_CAP, fill=ACCENT + (190,))
        d.text((x0 + 128, y1 + 21), "269 轮 · 205 tok/s · ¥15.52 · 缓存 99%",
               font=F_STATUS, fill=p["muted"] + (255,))

    return layer(img, paint)


def draw_pointer(img, p, pos):
    px, py = pos

    def paint(d):
        d.ellipse([px - 20, py - 20, px + 20, py + 20], outline=ACCENT + (45,))
        d.ellipse([px - 10, py - 10, px + 10, py + 10], outline=ACCENT + (150,))
        for k in range(4):
            ang = k * math.pi / 2 + 0.4
            d.line([px + math.cos(ang) * 14, py + math.sin(ang) * 14,
                    px + math.cos(ang) * 20, py + math.sin(ang) * 20], fill=ACCENT + (120,))
        d.ellipse([px - 2, py - 2, px + 2, py + 2], fill=ACCENT + (230,))
        d.text((px + 22, py - 12), "X 0666  Y 0456", font=F_TINY, fill=p["muted"] + (255,))

    return layer(img, paint)


def compose(dark=False, intro=1.0, pointer=(760, 300)):
    img, p = new_canvas(dark)
    img = draw_ring(img, p, intro)
    img = draw_sidebar(img, p)
    img = draw_frame(img, p)
    img = draw_composer(img, p)
    if pointer:
        img = draw_pointer(img, p, pointer)
    return img.convert("RGB")


if __name__ == "__main__":
    compose(False).save(os.path.join(OUT, "preview-light.png"))
    compose(True).save(os.path.join(OUT, "preview-dark.png"))
    frames = []
    for i in range(12):
        t = i / 11.0
        ease = 1 - (1 - t) ** 3
        frames.append(compose(False, ease).convert("P", palette=Image.ADAPTIVE, colors=64))
    frames[0].save(os.path.join(OUT, "intro.gif"), save_all=True, append_images=frames[1:],
                   duration=220, loop=0, optimize=True)
    for n in ("preview-light.png", "preview-dark.png", "intro.gif"):
        fp = os.path.join(OUT, n)
        print("  %-20s %7.1f KB" % (n, os.path.getsize(fp) / 1024))
