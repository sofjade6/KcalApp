#!/usr/bin/env python3
"""Construit la base aliments locale a partir de la table CIQUAL 2020 (ANSES).

Telecharge l'archive XML officielle, la nettoie (le XML publie n'est pas
bien forme : caracteres `<` et `&` non echappes dans les libelles), et
n'extrait que les 8 nutriments utiles a l'app.

Sortie : public/data/ciqual.json (~470 Ko brut, ~95 Ko une fois gzippe
par le serveur), charge une seule fois puis stocke en IndexedDB.

Usage : python3 scripts/build_ciqual.py
Source : https://ciqual.anses.fr - Licence Ouverte (Etalab)
"""

import io
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ARCHIVE_URL = "https://ciqual.anses.fr/cms/sites/default/files/inline-files/XML_2020_07_07.zip"
SORTIE = Path(__file__).resolve().parent.parent / "public" / "data" / "ciqual.json"

# Codes constituants CIQUAL -> cles courtes utilisees dans l'app.
# 328 est l'energie au sens du reglement UE 1169/2011 (celle des etiquettes) ;
# 333 (facteur de Jones) sert de repli quand 328 est absent.
NUTRIMENTS = {
    "328": "kcal",
    "25000": "prot",
    "40000": "lip",
    "40302": "ags",
    "31000": "gluc",
    "32000": "suc",
    "34100": "fib",
    "10004": "sel",
}
ENERGIE_REPLI = "333"

_LT_INVALIDE = re.compile(r"<(?![a-zA-Z/?!])")
_AMP_INVALIDE = re.compile(r"&(?!(?:[a-zA-Z]+|#\d+);)")


def lire_xml(archive: zipfile.ZipFile, nom: str) -> ET.Element:
    texte = archive.read(nom).decode("cp1252")
    texte = _AMP_INVALIDE.sub("&amp;", texte)
    texte = _LT_INVALIDE.sub("&lt;", texte)
    return ET.fromstring(texte)


def teneur(brut: str | None) -> float | None:
    """Convertit une teneur CIQUAL en nombre. `-` = non mesure, `traces` = 0."""
    if not brut:
        return None
    valeur = brut.strip().replace(",", ".").replace("<", "").replace("traces", "0")
    if valeur in ("", "-"):
        return None
    try:
        return round(float(valeur), 2)
    except ValueError:
        return None


def main() -> None:
    print(f"Telechargement de {ARCHIVE_URL}")
    with urllib.request.urlopen(ARCHIVE_URL, timeout=120) as reponse:
        archive = zipfile.ZipFile(io.BytesIO(reponse.read()))

    def fichier(prefixe: str) -> str:
        return next(n for n in archive.namelist() if Path(n).name.startswith(prefixe))

    groupes = {}
    for groupe in lire_xml(archive, fichier("alim_grp_")):
        code = (groupe.findtext("alim_grp_code") or "").strip()
        groupes[code] = (groupe.findtext("alim_grp_nom_fr") or "").strip()

    aliments = {}
    for aliment in lire_xml(archive, fichier("alim_2")):
        code = (aliment.findtext("alim_code") or "").strip()
        aliments[code] = {
            "c": code,
            "n": (aliment.findtext("alim_nom_fr") or "").strip(),
            "g": (aliment.findtext("alim_grp_code") or "").strip(),
        }

    energie_repli = {}
    for ligne in lire_xml(archive, fichier("compo_")):
        code_const = (ligne.findtext("const_code") or "").strip()
        code_alim = (ligne.findtext("alim_code") or "").strip()
        if code_alim not in aliments:
            continue
        valeur = teneur(ligne.findtext("teneur"))
        if valeur is None:
            continue
        if code_const in NUTRIMENTS:
            aliments[code_alim][NUTRIMENTS[code_const]] = valeur
        elif code_const == ENERGIE_REPLI:
            energie_repli[code_alim] = valeur

    replis = 0
    for code, valeur in energie_repli.items():
        if "kcal" not in aliments[code]:
            aliments[code]["kcal"] = valeur
            replis += 1

    # Un aliment sans energie connue n'est pas exploitable pour un suivi calorique.
    retenus = [a for a in aliments.values() if "kcal" in a]

    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(
        json.dumps(
            {"version": "ciqual-2020-07-07", "groupes": groupes, "aliments": retenus},
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(
        f"{len(retenus)} aliments ecrits dans {SORTIE} "
        f"({SORTIE.stat().st_size / 1024:.0f} Ko, dont {replis} energies issues du repli)"
    )


if __name__ == "__main__":
    main()
