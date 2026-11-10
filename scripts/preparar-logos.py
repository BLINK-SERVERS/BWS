#!/usr/bin/env python3
# ============================================================
# preparar-logos.py — fabrica src/assets/logos/*.png
# ------------------------------------------------------------
# El dueño del proyecto entregó el 2026-11-10 nueve capturas JPG con los
# lockups OFICIALES a color de las marcas de la cinta (aws, supabase,
# neon, cloudflare, github, zoho-mail, qoder y nic-ve; la novena era
# qoder repetida, md5 idéntico). Están archivados sin tocar en
# `src/assets/logos/origen/`: son la procedencia de lo que se publica y
# si mañana llega el SVG oficial se vuelve a correr este script con esa
# fuente.
#
# Un JPG no se puede colgar de una página: no tiene canal alfa y el
# fondo viene cocido en la foto (negro en cinco, blanco en dos, gris
# #f3f5f4 en GitHub). La cinta va sobre el blanco de la sección clara,
# así que lo que hay que hacer es quitarle el fondo a cada uno sin
# tocarle el color de la tinta. Eso es lo que hace este script:
#
#   1. MEDIR el fondo: mediana de los píxeles del borde (no de todo el
#      histograma: la tinta también es píxel).
#   2. CLAVEAR por luminancia con firma: `d = (luminancia − luminancia
#      del fondo) x senal`, donde `senal` vale +1 si el fondo es oscuro
#      y −1 si es claro. Con eso una sola fórmula sirve para el navy
#      #282838 sobre negro de AWS y para el negro sobre blanco de Neon.
#      `a` y `b` por marca son los extremos de la rampa, elegidos con el
#      histograma de colores dominantes (`/tmp/colores.py`, 2026-11-10):
#      `a` tiene que quedar por encima del ruido del JPEG y `b` por
#      debajo del color de tinta MÁS TENUE de esa marca, que es lo que
#      evita que el descriptor gris de Cloudflare (luma 56) se vuelva
#      fantasma. Dos marcas no se derivan solas y van a propósito:
#      `nic-ve` porque su halo de glow llega a luma 32 y hay que
#      cortarlo con `a`=60, y `qoder` porque su tinta es #1a1a1a sobre
#      #000 (luma 12) y sin `b`=10 no existe.
#   3. DECOMPOSICIÓN DE LA MEZCLA: el píxel de borde antialiased no es
#      la tinta, es `alpha·tinta + (1−alpha)·fondo`. Se despeja la tinta
#      en vez de recortarla, así el trazo no sale con un halo del color
#      del fondo — que sobre el blanco de la cinta se vería como un
#      fantasma gris alrededor de cada marca.
#   4. RECORTAR a la caja de tinta (caja del alfa >= 8) y EXPORTAR a la
#      altura óptica de la fila x 3 para que la cinta no se vea borrosa
#      en pantallas de 2x.
#
# Lo que NO hace: no redibuja, no recolorea, no convierte a vector. Las
# zonas encerradas que coinciden con el fondo (el gato blanco dentro del
# círculo de GitHub, el interior del sobre de Zoho) quedan transparentes
# y muestran el blanco de la sección, que es justo el color que tenían.
# Si algún día la cinta se mueve a un fondo que no sea blanco, hay que
# volver a este script y cambiar el clavado por un flood-fill desde el
# borde, que es lo que deja esas zonas opacas.
#
# Uso:  python3 scripts/preparar-logos.py [destino]
#       npm run logos
# ============================================================

import os
import re
import sys
from statistics import median

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, "src", "assets", "logos", "origen")
DESTINO = sys.argv[1] if len(sys.argv) > 1 else "src/assets/logos"
SALIDA = os.path.join(RAIZ, DESTINO)

# El ALTO óptico y el escalón de cada marca NO se copian aquí: se leen
# de `src/lib/socios.ts`, que es el único sitio donde el sitio los usa.
# Exportar un PNG a otra altura con otro `alto` en el CSS es la forma
# exacta de que la cinta salga descalibrada o borrosa, y un número
# duplicado en dos archivos se desincroniza. Lo único propio de este
# script son los umbrales del clavado, que dependen del JPG de origen y
# de nada más.
#
# ESCALON[1] y ESCALON[2] son los altos de tinta en pantalla de cada
# fila, en px; tienen que coincidir con `--glifo-1` y `--glifo-2` de
# `.lp-cinta` en `landing.css` (escritorio). MUESTRAS es cuántos px se
# exportan por px mostrado: la cinta se ve en pantallas de 2x y 3x.
ESCALON = {1: 34, 2: 24}
MUESTRAS = 3

# archivo -> (a, b): extremos de la rampa de alfa, en distancia de
# luminancia al fondo. `a` tiene que quedar por encima del ruido del
# JPEG y `b` por debajo del color de tinta MÁS TENUE de esa marca, que
# es lo que evita que el descriptor gris de Cloudflare (luma 56) o el
# navy de AWS (luma 41) se vuelvan fantasma. Los números se eligieron
# con el histograma de colores dominantes de cada captura, medido el
# 2026-11-10:
#   aws         navy #282838 (41) y naranja #f89808 (165) sobre #000
#   cloudflare  gris #383838 (56), naranja (159) y estrella blanca
#               sobre #000
#   supabase    gris #181818 (24) y verde #38c888 (149) sobre #000
#   qoder       #1a1a1a (12) sobre #000: sin esta rampa tan cerrada no existe
#   nic-ve      disco #08a8e8 (126) y caligrafía blanca (248) sobre
#               #000, con un halo de glow que llega a luma 32 y se corta
#   github      negro (8) sobre #f3f5f4 (244)
#   neon        negro (24) y verdes (165-187) sobre blanco
#   zoho-mail   negro (8), azul #1868b8 (88) y amarillo sobre blanco
UMBRALES = {
    "github":     (20, 60),
    "cloudflare": (12, 40),
    "supabase":   (6, 20),
    "neon":       (20, 60),
    "aws":        (12, 32),
    "zoho-mail":  (20, 60),
    "qoder":      (3, 10),
    "nic-ve":     (60, 90),
}

FUENTE = os.path.join(RAIZ, "src", "lib", "socios.ts")
TOKEN = re.compile(r'nombre: "([^"]+)"|archivo: "([^"]+)"|alto: ([\d.]+)')

# Pesos Rec.601 enteros, desplazados 8 bits: luminancia sin coma flotante.
LUM = (77, 151, 28)


def leer_marcas():
    """nombre, archivo y alto tal como los usa el sitio, desde socios.ts."""
    texto = open(FUENTE, encoding="utf-8").read()
    fila1 = int(re.search(r"export const FILA_1 = (\d+)", texto).group(1))
    cuerpo = texto[texto.index("export const SOCIOS"):]
    marcas, actual = [], {}
    for m in TOKEN.finditer(cuerpo):
        tipo, valor = m.lastindex, m.group(m.lastindex)
        if tipo == 1:
            if actual:
                marcas.append(actual)
            actual = {"nombre": valor}
        elif actual is not None:
            if tipo == 2:
                actual["archivo"] = valor
            elif tipo == 3:
                actual["alto"] = float(valor)
    if actual:
        marcas.append(actual)
    for i, m in enumerate(marcas):
        m["escalon"] = 1 if i < fila1 else 2
    return marcas


def luminancia(r, g, b):
    return (r * LUM[0] + g * LUM[1] + b * LUM[2]) >> 8


def fondo(im):
    """Mediana de los píxeles del borde: el color cocido de la captura."""
    w, h = im.size
    px = im.load()
    xs = range(0, w, max(1, w // 64))
    ys = range(0, h, max(1, h // 64))
    borde = [px[x, 0] for x in xs] + [px[x, h - 1] for x in xs]
    borde += [px[0, y] for y in ys] + [px[w - 1, y] for y in ys]
    return tuple(int(median(c[i] for c in borde)) for i in range(3))


def clavear(im, a, b):
    """RGBA con el fondo claveado y la tinta desmezclada."""
    w, h = im.size
    bg = fondo(im)
    bglum = luminancia(*bg)
    senal = 1 if bglum <= 128 else -1
    datos = im.tobytes()
    rgba = bytearray(w * h * 4)
    for i in range(0, w * h):
        o = i * 3
        r, g, bl = datos[o], datos[o + 1], datos[o + 2]
        d = (luminancia(r, g, bl) - bglum) * senal
        if d <= a:
            j = i * 4
            rgba[j:j + 4] = b"\x00\x00\x00\x00"
            continue
        alfa = 255 if d >= b else int(255 * (d - a) / (b - a))
        if alfa < 8:
            j = i * 4
            rgba[j:j + 4] = b"\x00\x00\x00\x00"
            continue
        k = alfa / 255.0
        j = i * 4
        for c, valor in enumerate((r, g, bl)):
            tinta = (valor - (1 - k) * bg[c]) / k
            # El desmezclado amplifica el ruido donde el alfa es chico:
            # se limita a no ir más allá del propio fondo.
            tinta = min(255, max(0, round(tinta)))
            rgba[j + c] = tinta
        rgba[j + 3] = alfa
    salida = Image.frombytes("RGBA", (w, h), bytes(rgba))
    return salida, bg


def recortar(im, relleno):
    caja = im.split()[3].point(lambda v: 255 if v >= 8 else 0).getbbox()
    rec = im.crop(caja)
    tam = (rec.width + relleno * 2, rec.height + relleno * 2)
    lienzo = Image.new("RGBA", tam, (0, 0, 0, 0))
    lienzo.paste(rec, (relleno, relleno), rec)
    return lienzo, caja


def main():
    os.makedirs(SALIDA, exist_ok=True)
    marcas = leer_marcas()
    total = 0
    print(f"{'marca':12s} f  {'fondo':9s} {'caja de tinta':14s} "
          f"{'aspecto':7s} {'alto':5s} {'px':>11s} {'KB':>6s}")
    for marca in marcas:
        nombre, archivo, escalon, optico = (
            marca["nombre"], marca["archivo"], marca["escalon"], marca["alto"])
        if archivo not in UMBRALES:
            print(f"{nombre:12s} — sin lockup de origen: se compone")
            continue
        a, b = UMBRALES[archivo]
        ruta = os.path.join(ORIGEN, archivo + ".jpg")
        im = Image.open(ruta).convert("RGB")
        claveada, bg = clavear(im, a, b)
        recortada, caja = recortar(claveada, max(2, round(im.size[1] * 0.012)))
        alto_px = round(ESCALON[escalon] * optico * MUESTRAS)
        ancho_px = max(1, round(recortada.width * alto_px / recortada.height))
        final = recortada.resize((ancho_px, alto_px), Image.LANCZOS)
        destino = os.path.join(SALIDA, archivo + ".png")
        final.save(destino, "PNG", optimize=True, compress_level=9)
        peso = os.path.getsize(destino)
        total += peso
        tinta = (caja[2] - caja[0], caja[3] - caja[1])
        print(f"{nombre:12s} {escalon}  #{bg[0]:02x}{bg[1]:02x}{bg[2]:02x}   "
              f"{tinta[0]}x{tinta[1]:9d} {tinta[0] / tinta[1]:6.2f}x "
              f"{optico:5.2f} {ancho_px:5d}x{alto_px:<4d} {peso / 1024:5.1f}")
    print(f"\n{total/1024:.0f} KB exportados · escalones {ESCALON[1]} y "
          f"{ESCALON[2]} px a {MUESTRAS}x · altos leidos de socios.ts")


if __name__ == "__main__":
    main()
