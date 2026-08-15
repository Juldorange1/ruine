#!/usr/bin/env python3
"""
Récupère le Pokédex complet (données + artworks officiels) depuis PokeAPI
(https://pokeapi.co, open data, usage libre non-commercial) et le met en
cache localement pour un usage 100% hors-ligne dans l'application.

Toutes les réponses JSON brutes sont mises en cache disque (data/_cache/)
pour rendre le script reprenable : on peut l'interrompre et le relancer,
seules les requêtes manquantes seront refaites.

Usage:
    python fetch_pokedex.py [--limit N] [--workers N]
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://pokeapi.co/api/v2"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT, "data", "_cache")
IMAGES_DIR = os.path.join(ROOT, "images", "pokemon")
FORMS_DIR = os.path.join(IMAGES_DIR, "forms")
OUT_JSON = os.path.join(ROOT, "data", "pokedex.json")
OUT_JS = os.path.join(ROOT, "data", "pokedex.js")

HEADERS = {"User-Agent": "JulGame-Pokedex-Perso/1.0 (usage prive hors-ligne)"}

REGION_FR = {
    "kanto": "Kanto",
    "johto": "Johto",
    "hoenn": "Hoenn",
    "sinnoh": "Sinnoh",
    "unova": "Unys",
    "kalos": "Kalos",
    "alola": "Alola",
    "galar": "Galar",
    "hisui": "Hisui",
    "paldea": "Paldea",
}

STAT_KEYS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"]

# PokeAPI ne fournit pas de noms localisés pour growth-rate : traduction
# manuelle des 6 catégories officielles (mécanique de jeu standard, pas une
# donnée inventée).
GROWTH_RATE_FR = {
    "slow": "Lente",
    "medium": "Moyenne",
    "fast": "Rapide",
    "medium-slow": "Moyenne lente",
    "slow-then-very-fast": "Lente puis très rapide",
    "fast-then-very-slow": "Rapide puis très lente",
}


def log(msg):
    print(f"[fetch] {msg}", flush=True)


def cache_path(key):
    safe = re.sub(r"[^a-zA-Z0-9_.-]", "_", key)
    return os.path.join(CACHE_DIR, safe + ".json")


def get_json(url, retries=4):
    key = url.replace(BASE, "").strip("/")
    path = cache_path(key)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.load(resp)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f)
            return data
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"Echec fetch {url}: {last_err}")


def download_image(url, dest):
    if os.path.exists(dest):
        return True
    if not url:
        return False
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = resp.read()
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            tmp = dest + ".tmp"
            with open(tmp, "wb") as f:
                f.write(data)
            os.replace(tmp, dest)
            return True
        except Exception:  # noqa: BLE001
            time.sleep(0.5 * (attempt + 1))
    return False


def species_id_from_url(url):
    m = re.search(r"/(\d+)/?$", url)
    return int(m.group(1)) if m else None


def fetch_names_fr(endpoint, workers):
    """Récupère le nom français de chaque entrée d'un petit endpoint de
    référence PokeAPI (type, egg-group, growth-rate...)."""
    idx = get_json(f"{BASE}/{endpoint}?limit=100")
    out = {}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(get_json, t["url"]): t["name"] for t in idx["results"]}
        for fut in as_completed(futs):
            name = futs[fut]
            data = fut.result()
            fr = next((n["name"] for n in data.get("names", []) if n["language"]["name"] == "fr"), name)
            out[name] = fr
    return out


def fetch_types(workers):
    log("Récupération des types...")
    return fetch_names_fr("type", workers)


def fetch_ability_names(ability_slugs, workers):
    log(f"Récupération des noms de {len(ability_slugs)} talents...")
    out = {}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(get_json, f"{BASE}/ability/{slug}"): slug for slug in ability_slugs}
        for fut in as_completed(futs):
            slug = futs[fut]
            try:
                data = fut.result()
            except Exception:  # noqa: BLE001
                out[slug] = slug
                continue
            fr = next((n["name"] for n in data.get("names", []) if n["language"]["name"] == "fr"), slug)
            out[slug] = fr
    return out


def gender_label(gender_rate):
    if gender_rate is None or gender_rate == -1:
        return "Asexué"
    female_pct = round(gender_rate / 8 * 100)
    return f"{100 - female_pct}% mâle / {female_pct}% femelle"


def clean_flavor_text(text):
    return re.sub(r"\s+", " ", text.replace("\f", " ").replace("\n", " ")).strip()


def extract_flavor_text_fr(species):
    entries = [e for e in species.get("flavor_text_entries", []) if e["language"]["name"] == "fr"]
    if not entries:
        return None
    return clean_flavor_text(entries[-1]["flavor_text"])


def extract_abilities(pk, ability_names_fr):
    out = []
    for a in pk.get("abilities", []):
        slug = a["ability"]["name"]
        out.append({"name": ability_names_fr.get(slug, slug), "hidden": a["is_hidden"]})
    return out


def fetch_generations():
    log("Récupération des générations/régions...")
    idx = get_json(f"{BASE}/generation?limit=20")
    gens = {}
    for g in idx["results"]:
        data = get_json(g["url"])
        num = data["id"]
        region_slug = data["main_region"]["name"]
        gens[num] = REGION_FR.get(region_slug, region_slug.capitalize())
    return gens


def build_evolution_map(chain_data):
    """Retourne dict species_id -> {evolves_from, evolves_to:[ids]}"""
    result = {}

    def walk(node, parent_id):
        sid = species_id_from_url(node["species"]["url"])
        result.setdefault(sid, {"evolves_from": parent_id, "evolves_to": []})
        result[sid]["evolves_from"] = parent_id
        for child in node.get("evolves_to", []):
            cid = species_id_from_url(child["species"]["url"])
            result[sid]["evolves_to"].append(cid)
            walk(child, sid)

    walk(chain_data["chain"], None)
    return result


def clean_form_name(slug, base_name):
    tail = slug[len(base_name):].strip("-") if slug.startswith(base_name) else slug
    tail = tail.replace("-", " ").strip()
    return tail.capitalize() if tail else slug


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=1025)
    parser.add_argument("--workers", type=int, default=16)
    args = parser.parse_args()

    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(FORMS_DIR, exist_ok=True)

    types_fr = fetch_types(args.workers)
    gens_fr = fetch_generations()
    log("Récupération des groupes d'œufs...")
    egg_groups_fr = fetch_names_fr("egg-group", args.workers)

    species_ids = list(range(1, args.limit + 1))
    log(f"Récupération de {len(species_ids)} fiches espèce + pokemon...")

    species_data = {}
    pokemon_data = {}

    def fetch_species(sid):
        return sid, get_json(f"{BASE}/pokemon-species/{sid}")

    def fetch_pokemon(sid):
        return sid, get_json(f"{BASE}/pokemon/{sid}")

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(fetch_species, sid) for sid in species_ids]
        done = 0
        for fut in as_completed(futs):
            sid, data = fut.result()
            species_data[sid] = data
            done += 1
            if done % 100 == 0:
                log(f"  espèces: {done}/{len(species_ids)}")

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(fetch_pokemon, sid) for sid in species_ids]
        done = 0
        for fut in as_completed(futs):
            sid, data = fut.result()
            pokemon_data[sid] = data
            done += 1
            if done % 100 == 0:
                log(f"  pokemon: {done}/{len(species_ids)}")

    log("Récupération des chaînes d'évolution (dédupliquées)...")
    chain_urls = {}
    for sid, sp in species_data.items():
        ec = sp.get("evolution_chain")
        if ec:
            chain_urls[ec["url"]] = True

    evo_map = {}
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(get_json, url): url for url in chain_urls}
        done = 0
        for fut in as_completed(futs):
            data = fut.result()
            evo_map.update(build_evolution_map(data))
            done += 1
            if done % 50 == 0:
                log(f"  chaines: {done}/{len(chain_urls)}")

    log("Récupération des formes alternatives...")
    form_jobs = []
    for sid, sp in species_data.items():
        for variety in sp.get("varieties", []):
            if variety["is_default"]:
                continue
            vid = species_id_from_url(variety["pokemon"]["url"])
            form_jobs.append((sid, vid, variety["pokemon"]["url"]))

    forms_by_species = {}
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(get_json, url): (sid, vid) for sid, vid, url in form_jobs}
        done = 0
        for fut in as_completed(futs):
            sid, vid = futs[fut]
            try:
                data = fut.result()
            except Exception as e:  # noqa: BLE001
                log(f"  form {vid} échec: {e}")
                continue
            forms_by_species.setdefault(sid, []).append(data)
            done += 1
            if done % 50 == 0:
                log(f"  formes: {done}/{len(form_jobs)}")

    ability_slugs = set()
    for pk in pokemon_data.values():
        for a in pk.get("abilities", []):
            ability_slugs.add(a["ability"]["name"])
    for forms in forms_by_species.values():
        for form_pk in forms:
            for a in form_pk.get("abilities", []):
                ability_slugs.add(a["ability"]["name"])
    ability_names_fr = fetch_ability_names(sorted(ability_slugs), args.workers)

    log("Assemblage du JSON final...")
    entries = []
    for sid in species_ids:
        sp = species_data.get(sid)
        pk = pokemon_data.get(sid)
        if not sp or not pk:
            continue
        name_fr = next((n["name"] for n in sp["names"] if n["language"]["name"] == "fr"), sp["name"])
        name_en = next((n["name"] for n in sp["names"] if n["language"]["name"] == "en"), sp["name"])
        gen_num = roman_to_int(sp["generation"]["name"].split("-")[-1])
        types = [types_fr.get(t["type"]["name"], t["type"]["name"]) for t in sorted(pk["types"], key=lambda t: t["slot"])]
        stats = {s["stat"]["name"]: s["base_stat"] for s in pk["stats"]}
        evo = evo_map.get(sid, {"evolves_from": None, "evolves_to": []})

        forms = []
        for form_pk in forms_by_species.get(sid, []):
            fid = form_pk["id"]
            img_url = (form_pk.get("sprites", {}).get("other", {}).get("official-artwork", {}) or {}).get("front_default") \
                or (form_pk.get("sprites", {}) or {}).get("front_default")
            dest = os.path.join(FORMS_DIR, f"{fid:05d}.png")
            download_image(img_url, dest)
            form_stats = {s["stat"]["name"]: s["base_stat"] for s in form_pk.get("stats", [])}
            forms.append({
                "id": fid,
                "name": clean_form_name(form_pk["name"], sp["name"]),
                "types": [types_fr.get(t["type"]["name"], t["type"]["name"]) for t in sorted(form_pk["types"], key=lambda t: t["slot"])],
                "image": f"images/pokemon/forms/{fid:05d}.png" if os.path.exists(dest) else None,
                "height_dm": form_pk.get("height"),
                "weight_hg": form_pk.get("weight"),
                "base_stats": {k: form_stats.get(k, 0) for k in STAT_KEYS} if form_stats else None,
                "abilities": extract_abilities(form_pk, ability_names_fr),
                "base_experience": form_pk.get("base_experience"),
            })

        artwork = (pk.get("sprites", {}).get("other", {}).get("official-artwork", {}) or {}).get("front_default")
        img_dest = os.path.join(IMAGES_DIR, f"{sid:04d}.png")
        download_image(artwork, img_dest)

        egg_groups = [egg_groups_fr.get(g["name"], g["name"]) for g in sp.get("egg_groups", [])]
        growth_rate_slug = (sp.get("growth_rate") or {}).get("name")

        entries.append({
            "id": sid,
            "name": name_fr,
            "name_en": name_en,
            "number": sid,
            "types": types,
            "generation": gen_num,
            "region": gens_fr.get(gen_num, "?"),
            "height_dm": pk["height"],
            "weight_hg": pk["weight"],
            "base_stats": {k: stats.get(k, 0) for k in STAT_KEYS},
            "evolves_from": evo["evolves_from"],
            "evolves_to": evo["evolves_to"],
            "is_legendary": sp.get("is_legendary", False),
            "is_mythical": sp.get("is_mythical", False),
            "forms": forms,
            "image": f"images/pokemon/{sid:04d}.png" if os.path.exists(img_dest) else None,
            "abilities": extract_abilities(pk, ability_names_fr),
            "base_experience": pk.get("base_experience"),
            "capture_rate": sp.get("capture_rate"),
            "base_happiness": sp.get("base_happiness"),
            "gender_label": gender_label(sp.get("gender_rate")),
            "hatch_counter": sp.get("hatch_counter"),
            "egg_groups": egg_groups,
            "growth_rate": GROWTH_RATE_FR.get(growth_rate_slug, growth_rate_slug),
            "flavor_text": extract_flavor_text_fr(sp),
        })

    payload = {"generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "count": len(entries), "pokemon": entries}

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)

    # Doublon en .js (window.POKEDEX_JSON = {...}) : permet à l'appli de charger les
    # données via une balise <script> plutôt qu'un fetch(), qui échoue en file:// dans
    # la plupart des navigateurs (CORS sur les requêtes locales).
    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write("window.POKEDEX_JSON = ")
        json.dump(payload, f, ensure_ascii=False)
        f.write(";\n")

    log(f"Terminé: {len(entries)} Pokémon écrits dans {OUT_JSON} et {OUT_JS}")


def roman_to_int(s):
    vals = {"i": 1, "v": 5, "x": 10}
    s = s.lower()
    total = 0
    prev = 0
    for ch in reversed(s):
        v = vals.get(ch, 0)
        if v < prev:
            total -= v
        else:
            total += v
            prev = v
    return total


if __name__ == "__main__":
    main()
