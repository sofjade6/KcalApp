#!/usr/bin/env python3
"""Genere les icones PNG de la PWA (manifeste + apple-touch-icon).

Aucune dependance : encodeur PNG minimal + rasterisation par sur-echantillonnage.
La marque reprend l'anneau de l'ecran du jour — trois arcs aux couleurs des
macros (proteines / lipides / glucides) sur une piste sombre.

Usage : python3 scripts/build_icons.py
"""

import math
import struct
import zlib
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
ICONES = RACINE / "public" / "icons"

FOND = (0x10, 0x14, 0x18)
PISTE = (0x2C, 0x34, 0x3A)
ARCS = [
    ((0x39, 0x87, 0xE5), 0.00, 0.30),  # proteines
    ((0xD9, 0x59, 0x26), 0.33, 0.60),  # lipides
    ((0x19, 0x9E, 0x70), 0.63, 0.86),  # glucides
]

SUR_ECHANTILLONNAGE = 4


def ecrire_png(chemin: Path, largeur: int, hauteur: int, pixels: bytearray) -> None:
    lignes = b"".join(
        b"\x00" + bytes(pixels[y * largeur * 4 : (y + 1) * largeur * 4])
        for y in range(hauteur)
    )

    def bloc(nom: bytes, donnees: bytes) -> bytes:
        corps = nom + donnees
        return (
            struct.pack(">I", len(donnees))
            + corps
            + struct.pack(">I", zlib.crc32(corps) & 0xFFFFFFFF)
        )

    chemin.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + bloc(b"IHDR", struct.pack(">IIBBBBB", largeur, hauteur, 8, 6, 0, 0, 0))
        + bloc(b"IDAT", zlib.compress(lignes, 9))
        + bloc(b"IEND", b"")
    )


def couleur_en(x: float, y: float, taille: int, maskable: bool):
    """Couleur du point (x, y) en coordonnees pixel, ou None hors de l'icone."""
    centre = taille / 2

    if not maskable:
        # Coin arrondi facon iOS. Une icone maskable occupe tout le canevas :
        # c'est le systeme qui applique son propre masque.
        rayon = taille * 0.22
        dx = abs(x - centre) - (centre - rayon)
        dy = abs(y - centre) - (centre - rayon)
        if dx > 0 and dy > 0 and math.hypot(dx, dy) > rayon:
            return None

    # Une icone maskable doit tenir dans le cercle de securite (80 % du canevas).
    rayon_ext = taille * (0.26 if maskable else 0.33)
    epaisseur = rayon_ext * 0.34
    rayon_int = rayon_ext - epaisseur

    distance = math.hypot(x - centre, y - centre)
    if not (rayon_int <= distance <= rayon_ext):
        return FOND

    # t = 0 en haut, croissant dans le sens horaire.
    t = (math.atan2(x - centre, centre - y) / (2 * math.pi)) % 1.0
    for couleur, debut, fin in ARCS:
        if debut <= t < fin:
            return couleur
    return PISTE


def dessiner(taille: int, maskable: bool) -> bytearray:
    pixels = bytearray(taille * taille * 4)
    pas = 1.0 / SUR_ECHANTILLONNAGE
    poids = SUR_ECHANTILLONNAGE * SUR_ECHANTILLONNAGE

    for y in range(taille):
        for x in range(taille):
            r = v = b = a = 0
            for sy in range(SUR_ECHANTILLONNAGE):
                for sx in range(SUR_ECHANTILLONNAGE):
                    echantillon = couleur_en(
                        x + (sx + 0.5) * pas, y + (sy + 0.5) * pas, taille, maskable
                    )
                    if echantillon is not None:
                        r += echantillon[0]
                        v += echantillon[1]
                        b += echantillon[2]
                        a += 255
            i = (y * taille + x) * 4
            if a:
                # Les composantes ne sont moyennees que sur les sous-pixels opaques,
                # sinon les bords arrondis viraient au noir.
                opaques = a // 255
                pixels[i] = r // opaques
                pixels[i + 1] = v // opaques
                pixels[i + 2] = b // opaques
            pixels[i + 3] = a // poids
    return pixels


def main() -> None:
    ICONES.mkdir(parents=True, exist_ok=True)
    cibles = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-512-maskable.png", 512, True),
        ("apple-touch-icon.png", 180, True),  # iOS applique deja ses coins arrondis
    ]
    for nom, taille, maskable in cibles:
        chemin = ICONES / nom
        ecrire_png(chemin, taille, taille, dessiner(taille, maskable))
        print(f"{nom:26} {taille}x{taille}  {chemin.stat().st_size / 1024:.1f} Ko")


if __name__ == "__main__":
    main()
