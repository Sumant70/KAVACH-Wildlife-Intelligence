"""
KAVACH Wildlife Intelligence — Centralized 15-Animal Detection Configuration & Capability Engine.

==================================================
STRICT FILTER: ONLY THESE 15 APPROVED SPECIES ALLOWED
==================================================
1. Elephant
2. Tiger
3. Leopard
4. Wild Boar
5. Spotted Deer
6. Sloth Bear
7. Gaur / Indian Bison
8. Rhinoceros
9. Wild Buffalo
10. Crocodile
11. Snake
12. Cobra
13. Indian Python
14. Russell's Viper
15. Krait

CRITICAL CONSTRAINTS:
- Single centralized source of truth for allowed wildlife classes.
- Zero fake mappings (dog != wolf, cow != gaur, deer != tiger, cat != leopard, generic snake != cobra).
- Unsupported objects (person, car, dog, cow, cat, lion, bird, etc.) are strictly rejected.
- Only classes present in BOTH the loaded model AND ALLOWED_WILDLIFE can generate detections.
"""

from typing import List, Dict, Any, Optional, Set, Tuple


# ==============================================================================
# 1. CENTRALIZED ALLOWED WILDLIFE CONFIGURATION (THE ONLY AUTHORITATIVE LIST)
# ==============================================================================
ALLOWED_WILDLIFE = [
    "elephant",
    "tiger",
    "leopard",
    "wild_boar",
    "dog",
    "spotted_deer",
    "sloth_bear",
    "gaur",
    "rhinoceros",
    "wild_buffalo",
    "crocodile",
    "snake",
    "cobra",
    "indian_python",
    "russells_viper",
    "krait",
]

# Set representation for fast lookup
ALLOWED_WILDLIFE_SET: Set[str] = set(ALLOWED_WILDLIFE)


# ==============================================================================
# 2. CANONICAL METADATA & SPECIES ATTRIBUTES
# ==============================================================================
WILDLIFE_METADATA: Dict[str, Dict[str, Any]] = {
    "elephant": {
        "id": "elephant",
        "canonical": "Elephant",
        "scientific_name": "Elephas maximus",
        "aliases": ["elephant", "asian elephant", "asian_elephant", "elephas maximus", "elephas_maximus"],
        "emoji": "🐘",
        "threat_level": "HIGH",
        "hazard_score": 88.0
    },
    "tiger": {
        "id": "tiger",
        "canonical": "Tiger",
        "scientific_name": "Panthera tigris",
        "aliases": ["tiger", "bengal tiger", "bengal_tiger", "panthera tigris", "panthera_tigris"],
        "emoji": "🐅",
        "threat_level": "CRITICAL",
        "hazard_score": 95.0
    },
    "leopard": {
        "id": "leopard",
        "canonical": "Leopard",
        "scientific_name": "Panthera pardus",
        "aliases": ["leopard", "indian leopard", "indian_leopard", "panthera pardus", "panthera_pardus"],
        "emoji": "🐆",
        "threat_level": "CRITICAL",
        "hazard_score": 90.0
    },
    "wild_boar": {
        "id": "wild_boar",
        "canonical": "Wild Boar",
        "scientific_name": "Sus scrofa",
        "aliases": ["wild_boar", "wildboar", "wild boar", "boar", "sus scrofa", "sus_scrofa"],
        "emoji": "🐗",
        "threat_level": "MEDIUM",
        "hazard_score": 60.0
    },
    "spotted_deer": {
        "id": "spotted_deer",
        "canonical": "Spotted Deer",
        "scientific_name": "Axis axis",
        "aliases": ["spotted_deer", "spotted deer", "chital", "axis axis", "axis_axis"],
        "emoji": "🦌",
        "threat_level": "LOW",
        "hazard_score": 25.0
    },
    "sloth_bear": {
        "id": "sloth_bear",
        "canonical": "Sloth Bear",
        "scientific_name": "Melursus ursinus",
        "aliases": ["sloth_bear", "sloth bear", "melursus ursinus", "melursus_ursinus"],
        "emoji": "🐻",
        "threat_level": "HIGH",
        "hazard_score": 85.0
    },
    "gaur": {
        "id": "gaur",
        "canonical": "Gaur / Indian Bison",
        "scientific_name": "Bos gaurus",
        "aliases": ["gaur", "indian bison", "indian_bison", "bos gaurus", "bos_gaurus"],
        "emoji": "🦬",
        "threat_level": "HIGH",
        "hazard_score": 75.0
    },
    "rhinoceros": {
        "id": "rhinoceros",
        "canonical": "Rhinoceros",
        "scientific_name": "Rhinoceros unicornis",
        "aliases": ["rhinoceros", "rhino", "indian rhinoceros", "indian_rhinoceros", "one-horned rhino", "one_horned_rhino", "rhinoceros unicornis"],
        "emoji": "🦏",
        "threat_level": "HIGH",
        "hazard_score": 85.0
    },
    "wild_buffalo": {
        "id": "wild_buffalo",
        "canonical": "Wild Buffalo",
        "scientific_name": "Bubalus arnee",
        "aliases": ["wild_buffalo", "wild buffalo", "wild water buffalo", "wild_water_buffalo", "bubalus arnee"],
        "emoji": "🐃",
        "threat_level": "HIGH",
        "hazard_score": 80.0
    },
    "crocodile": {
        "id": "crocodile",
        "canonical": "Crocodile",
        "scientific_name": "Crocodylus palustris",
        "aliases": ["crocodile", "croc", "mugger", "mugger crocodile", "crocodylus palustris"],
        "emoji": "🐊",
        "threat_level": "HIGH",
        "hazard_score": 85.0
    },
    "snake": {
        "id": "snake",
        "canonical": "Snake",
        "scientific_name": "Serpentes",
        "aliases": ["snake", "serpentes"],
        "emoji": "🐍",
        "threat_level": "HIGH",
        "hazard_score": 75.0
    },
    "cobra": {
        "id": "cobra",
        "canonical": "Cobra",
        "scientific_name": "Naja naja",
        "aliases": ["cobra", "indian cobra", "indian_cobra", "naja naja", "naja_naja", "spectacled cobra"],
        "emoji": "🐍",
        "threat_level": "CRITICAL",
        "hazard_score": 90.0
    },
    "indian_python": {
        "id": "indian_python",
        "canonical": "Indian Python",
        "scientific_name": "Python molurus",
        "aliases": ["indian_python", "indian python", "python molurus", "python_molurus", "rock python"],
        "emoji": "🐍",
        "threat_level": "MEDIUM",
        "hazard_score": 70.0
    },
    "russells_viper": {
        "id": "russells_viper",
        "canonical": "Russell's Viper",
        "scientific_name": "Daboia russelii",
        "aliases": ["russells_viper", "russell's viper", "russells viper", "russell viper", "daboia russelii", "daboia_russelii"],
        "emoji": "🐍",
        "threat_level": "CRITICAL",
        "hazard_score": 92.0
    },
    "krait": {
        "id": "krait",
        "canonical": "Krait",
        "scientific_name": "Bungarus caeruleus",
        "aliases": ["krait", "common krait", "common_krait", "bungarus caeruleus", "bungarus_caeruleus"],
        "emoji": "🐍",
        "threat_level": "CRITICAL",
        "hazard_score": 95.0
    },
    "dog": {
        "id": "dog",
        "canonical": "Dog",
        "scientific_name": "Canis lupus familiaris",
        "aliases": ["dog", "domestic dog", "canis lupus familiaris", "canis_lupus_familiaris", "hound", "canine", "puppy", "indie", "pariah"],
        "emoji": "🐕",
        "threat_level": "ALERT",
        "hazard_score": 45.0
    }
}

# Domestic animals (kept for reference)
DOMESTIC_ANIMAL_METADATA: Dict[str, Dict[str, Any]] = {
    "dog": {
        "id": "dog",
        "canonical": "Dog",
        "scientific_name": "Canis lupus familiaris",
        "aliases": ["dog", "domestic dog", "canis lupus familiaris", "canis_lupus_familiaris", "hound", "canine", "puppy", "indie", "pariah"],
        "emoji": "🐕",
        "threat_level": "ALERT",
        "hazard_score": 45.0
    }
}

# Lookup map: normalized alias -> canonical key (STRICTLY for ALLOWED_WILDLIFE_SET only)
_NORMALIZED_ALIAS_LOOKUP: Dict[str, str] = {}
for _key, _meta in WILDLIFE_METADATA.items():
    if _key not in ALLOWED_WILDLIFE_SET:
        continue
    for _alias in _meta["aliases"]:
        _norm = _alias.strip().lower().replace("_", "").replace("-", "").replace(" ", "").replace("'", "")
        _NORMALIZED_ALIAS_LOOKUP[_norm] = _key

# Disallowed non-wildlife and domestic object keywords (must never map to wildlife)
# NOTE: Dog is now an intentionally trained target class, so dog/puppy/canine are not disallowed.
DISALLOWED_TERMS = {
    "person", "human", "man", "woman", "people", "pedestrian", "child",
    "cat", "kitten", "feline",
    "cow", "cattle", "bull", "ox", "calf",
    "horse", "sheep", "goat", "donkey", "pig",
    "car", "automobile", "vehicle", "truck", "bus", "motorcycle", "bike", "bicycle",
    "bird", "airplane", "boat", "train",
    "lion", "cheetah"
}


# ==============================================================================
# 3. NORMALIZATION & STRICT WHITELIST MATCHING
# ==============================================================================
def normalize_class_name(raw_name: str) -> str:
    """
    Normalizes a model class label for deterministic matching.
    Lowercases and removes whitespace, hyphens, underscores, and quotes.
    """
    if not raw_name:
        return ""
    return str(raw_name).strip().lower().replace("_", "").replace("-", "").replace(" ", "").replace("'", "")


def match_allowed_wildlife(raw_name: str) -> Optional[str]:
    """
    Checks if a raw class label from YOLO inference maps to one of the 15 approved wildlife species.
    Returns the canonical allowed key (e.g. 'elephant', 'tiger', 'snake') if matched, else None.
    
    STRICT SECURITY RULES:
    - Only matches against the 15 approved wildlife species.
    - Never maps unrelated animals (dog != wolf, cow != gaur, cat != leopard).
    - Never renames generic 'snake' to specific snake species (cobra, krait, python, viper).
    - Rejects humans, vehicles, domestic livestock, pets, and non-target wildlife (e.g. 'Lion', 'dog', 'person').
    """
    norm = normalize_class_name(raw_name)
    if not norm:
        return None
    if norm in DISALLOWED_TERMS:
        return None
    return _NORMALIZED_ALIAS_LOOKUP.get(norm, None)


def is_allowed_wildlife(name: str) -> bool:
    """Returns True if the given species name or key is one of the 15 approved wildlife species."""
    return match_allowed_wildlife(name) is not None


def get_wildlife_canonical_name(raw_or_key: str) -> Optional[str]:
    """Returns the user-facing canonical display name for an allowed wildlife class."""
    key = match_allowed_wildlife(raw_or_key)
    if key and key in WILDLIFE_METADATA:
        return WILDLIFE_METADATA[key]["canonical"]
    return None


def get_wildlife_emoji(raw_or_key: str) -> str:
    """Returns the species emoji for an allowed wildlife class, or '🐾' as default."""
    key = match_allowed_wildlife(raw_or_key)
    if key and key in WILDLIFE_METADATA:
        return WILDLIFE_METADATA[key]["emoji"]
    return "🐾"


# ==============================================================================
# 4. MODEL CAPABILITY CHECK & INTERSECTION ENGINE
# ==============================================================================
def evaluate_model_capabilities(raw_model_classes: Dict[int, str]) -> Dict[str, Any]:
    """
    Performs safe capability check against the actual loaded YOLO model:
    
    SUPPORTED_CLASSES = actual_model_classes
    EFFECTIVE_ALLOWED_CLASSES = intersection(ALLOWED_WILDLIFE, SUPPORTED_CLASSES)
    
    Only classes existing in BOTH lists can ever generate a detection.
    """
    class_id_to_allowed: Dict[int, Dict[str, Any]] = {}
    supported_species: List[Dict[str, Any]] = []
    unsupported_species: List[Dict[str, Any]] = []

    # Map raw model class IDs to allowed wildlife
    for cid, raw_name in raw_model_classes.items():
        matched_key = match_allowed_wildlife(raw_name)
        if matched_key:
            meta = WILDLIFE_METADATA[matched_key]
            allowed_info = {
                "key": matched_key,
                "canonical": meta["canonical"],
                "scientific_name": meta["scientific_name"],
                "raw_model_name": raw_name,
                "class_id": int(cid),
                "emoji": meta["emoji"],
                "threat_level": meta["threat_level"],
                "hazard_score": meta["hazard_score"]
            }
            class_id_to_allowed[int(cid)] = allowed_info
            supported_species.append(allowed_info)

    # Determine which of the 15 approved wildlife are absent from the model weights
    supported_keys = {s["key"] for s in supported_species}
    for key in ALLOWED_WILDLIFE:
        if key not in supported_keys:
            meta = WILDLIFE_METADATA[key]
            unsupported_species.append({
                "key": key,
                "canonical": meta["canonical"],
                "scientific_name": meta["scientific_name"],
                "status": "NOT_SUPPORTED_BY_CURRENT_MODEL",
                "note": "Requires custom wildlife-trained YOLO model"
            })

    return {
        "class_id_to_allowed": class_id_to_allowed,
        "supported_species": supported_species,
        "unsupported_species": unsupported_species,
        "effective_allowed_count": len(supported_species),
        "total_allowed_count": len(ALLOWED_WILDLIFE),
        "effective_allowed_keys": list(supported_keys),
        "requires_custom_model_count": len(unsupported_species)
    }
