import os
import io
import cv2
import torch
import logging
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional, Union, Tuple
from PIL import Image

from allowed_wildlife import (
    ALLOWED_WILDLIFE,
    WILDLIFE_METADATA,
    evaluate_model_capabilities,
    match_allowed_wildlife,
    normalize_class_name,
    get_wildlife_canonical_name,
    get_wildlife_emoji,
    is_allowed_wildlife
)

logger = logging.getLogger("kavach.detection")

BASE_DIR = Path(__file__).resolve().parent

# Configurable environment variables
DEFAULT_MODEL_PATH = (BASE_DIR / "best_kavach_5class.pt") if (BASE_DIR / "best_kavach_5class.pt").exists() else (BASE_DIR / "best.pt")
# Calibrated confidence floor (allows dynamic testing down to 0.20 while preventing noise)
MIN_WILDLIFE_CONFIDENCE = 0.20
_env_conf = float(os.getenv("WILDLIFE_CONFIDENCE_THRESHOLD", os.getenv("CONFIDENCE_THRESHOLD", "0.35")))
WILDLIFE_CONFIDENCE_THRESHOLD = max(_env_conf, MIN_WILDLIFE_CONFIDENCE)
IOU_THRESHOLD = float(os.getenv("IOU_THRESHOLD", "0.45"))
MODEL_PATH_ENV = os.getenv("MODEL_PATH", str(DEFAULT_MODEL_PATH))
CONFIGURED_DEVICE = os.getenv("DEVICE", "auto").lower()

# Backward compatibility map for other modules importing TARGET_CANONICAL_NAMES
TARGET_CANONICAL_NAMES: Dict[str, str] = {k: v["canonical"] for k, v in WILDLIFE_METADATA.items()}

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


class DetectionService:
    """
    Singleton AI Detection Service for KAVACH.
    - Loads pre-trained wildlife YOLO model once on startup.
    - Strictly validates against centralized ALLOWED_WILDLIFE (15 approved species).
    - Checks native model.names without arbitrary or fake class mappings.
    - Rejects non-target objects and animals (person, car, dog, cat, cow, lion, bird, etc.).
    - Evaluates capability intersection: Only classes existing in BOTH the model and
      ALLOWED_WILDLIFE can generate detections.
    """
    _instance: Optional["DetectionService"] = None

    def __new__(cls) -> "DetectionService":
        if cls._instance is None:
            cls._instance = super(DetectionService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.model = None
        self.model_status = "INITIALIZING"
        self.raw_model_classes: Dict[int, str] = {}
        self.device = self._resolve_device()

        # Dynamic target species mapping: class_id -> allowed_wildlife_info
        self.class_id_to_allowed: Dict[int, Dict[str, Any]] = {}
        self.supported_species: List[Dict[str, Any]] = []
        self.unsupported_species: List[Dict[str, Any]] = []
        self.model_classes: List[str] = []

        self._load_and_validate_model()
        self._initialized = True

    def _resolve_device(self) -> str:
        """Determines whether to use CUDA GPU or CPU."""
        if CONFIGURED_DEVICE == "cuda" or (CONFIGURED_DEVICE == "auto" and torch.cuda.is_available()):
            device_name = "cuda:0" if torch.cuda.is_available() else "cpu"
            logger.info("[YOLO] Using device: %s (%s)", device_name, torch.cuda.get_device_name(0) if torch.cuda.is_available() else "Fallback CPU")
            return device_name
        logger.info("[YOLO] Using device: cpu")
        return "cpu"

    def _load_and_validate_model(self):
        """
        Loads the pre-trained wildlife model and validates it against the 15 approved species.
        Inspects actual model.names without arbitrary or fake class mapping.
        """
        try:
            from ultralytics import YOLO
            model_path = Path(MODEL_PATH_ENV)

            if not model_path.exists():
                self.model_status = f"FAILED: Model weights not found at {model_path}"
                logger.error("[YOLO] %s does not exist.", model_path)
                return

            logger.info("[YOLO] Loading pre-trained wildlife model from %s...", model_path)
            self.model = YOLO(str(model_path))
            self.model.to(self.device)

            # Read actual class labels directly from the loaded model
            self.raw_model_classes = {int(k): str(v) for k, v in self.model.names.items()}
            self.model_status = f"ONLINE ({model_path.name})"

            # Evaluate capabilities against centralized 15-animal list
            capabilities = evaluate_model_capabilities(self.raw_model_classes)
            self.class_id_to_allowed = capabilities["class_id_to_allowed"]
            self.supported_species = capabilities["supported_species"]
            self.unsupported_species = capabilities["unsupported_species"]
            self.model_classes = [s["canonical"] for s in self.supported_species]

            # Print Model Validation Report on startup
            self._log_validation_report(model_path.name)

        except Exception as e:
            self.model_status = f"LOAD_ERROR: {e}"
            logger.error("[YOLO] Failed to load YOLO wildlife model: %s", e, exc_info=True)

    def _log_validation_report(self, model_name: str):
        """Prints a clear, structured model validation report to the console."""
        sep = "=" * 76
        print(f"\n{sep}", flush=True)
        print("          KAVACH WILDLIFE MODEL VALIDATION REPORT — 15-ANIMAL STRICT FILTER", flush=True)
        print(f"{sep}", flush=True)
        print(f"Model File:               {model_name}", flush=True)
        print(f"Native Model Classes:     {self.raw_model_classes}", flush=True)
        print(f"Confidence Cutoff:        {WILDLIFE_CONFIDENCE_THRESHOLD:.2f}", flush=True)
        print(f"Approved Wildlife Target: 15 Centralized Species", flush=True)
        print(f"Genuinely Supported:      {len(self.supported_species)} classes present in model weights", flush=True)
        print(f"Requires Custom Model:    {len(self.unsupported_species)} classes missing from model weights", flush=True)
        print("\nTarget Species Breakdown (15 Approved Wildlife Classes):", flush=True)

        idx = 1
        for s in self.supported_species:
            print(f"  [{idx:2d}] {s['canonical']:<22}: SUPPORTED     (Class ID: {s['class_id']}, Raw Label: '{s['raw_model_name']}')", flush=True)
            idx += 1

        for s in self.unsupported_species:
            print(f"  [{idx:2d}] {s['canonical']:<22}: NOT SUPPORTED (Requires wildlife-trained YOLO model)", flush=True)
            idx += 1

        print(f"{sep}\n", flush=True)

    def get_validation_summary(self) -> Dict[str, Any]:
        """Returns structured metadata on supported vs unsupported target species."""
        return {
            "model_status": self.model_status,
            "confidence_threshold": WILDLIFE_CONFIDENCE_THRESHOLD,
            "iou_threshold": IOU_THRESHOLD,
            "raw_classes": self.raw_model_classes,
            "supported_count": len(self.supported_species),
            "unsupported_count": len(self.unsupported_species),
            "total_allowed_count": len(ALLOWED_WILDLIFE),
            "allowed_wildlife": ALLOWED_WILDLIFE,
            "supported_species": self.supported_species,
            "unsupported_species": self.unsupported_species
        }

    def validate_image_file(self, file_bytes: bytes, filename: str) -> Tuple[bool, Optional[str]]:
        """Validates file extension, size, and image readability."""
        if not file_bytes or len(file_bytes) == 0:
            return False, "Uploaded file is empty."

        if len(file_bytes) > MAX_FILE_SIZE:
            return False, f"File size exceeds 25MB limit ({len(file_bytes) // (1024*1024)}MB)."

        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            return False, f"Unsupported image format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}."

        try:
            pil_img = Image.open(io.BytesIO(file_bytes))
            pil_img.verify()
        except Exception as e:
            return False, f"Image file appears corrupted or unreadable: {e}"

        return True, None

    def detect_image(
        self,
        image_input: Union[str, Path, bytes, np.ndarray],
        conf_threshold: Optional[float] = None,
        imgsz: int = 640
    ) -> List[Dict[str, Any]]:
        """
        Runs YOLO inference on a still image (file path, raw bytes, or numpy array).
        Applies strict 15-animal target species filtering.
        """
        conf = max(conf_threshold if conf_threshold is not None else WILDLIFE_CONFIDENCE_THRESHOLD, MIN_WILDLIFE_CONFIDENCE)

        # Read image to numpy BGR array if necessary
        frame = None
        if isinstance(image_input, (str, Path)):
            frame = cv2.imread(str(image_input))
            if frame is None:
                raise ValueError(f"Could not load image from path: {image_input}")
        elif isinstance(image_input, bytes):
            nparr = np.frombuffer(image_input, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                raise ValueError("Could not decode image bytes into valid image frame.")
        elif isinstance(image_input, np.ndarray):
            frame = image_input
        else:
            raise TypeError("Unsupported image input type.")

        return self.detect_frame(frame, conf_threshold=conf, imgsz=imgsz)

    def detect_frame(
        self,
        frame_bgr: np.ndarray,
        conf_threshold: Optional[float] = None,
        imgsz: int = 640
    ) -> List[Dict[str, Any]]:
        """
        Runs YOLO inference on a BGR video or camera frame.
        STRICT 15-ANIMAL FILTERING PIPELINE:
        1. Get real model class ID.
        2. Get real class name from loaded model.
        3. Check it against centralized ALLOWED_WILDLIFE list.
        4. If allowed and confidence >= 0.50 threshold -> Return detection.
        5. For everything else (unsupported animals, humans, vehicles, objects) -> REJECT.
        """
        if frame_bgr is None or frame_bgr.size == 0:
            return []

        conf = max(conf_threshold if conf_threshold is not None else WILDLIFE_CONFIDENCE_THRESHOLD, MIN_WILDLIFE_CONFIDENCE)
        if self.model is None:
            logger.warning("[YOLO] Inference requested but model is not loaded.")
            return []

        fh, fw = frame_bgr.shape[:2]
        print(f"[YOLO DEBUG] Resolution: Original={fw}x{fh}, Inference={imgsz}x{imgsz}", flush=True)

        detections: List[Dict[str, Any]] = []

        try:
            results = self.model(
                frame_bgr,
                conf=conf,
                iou=IOU_THRESHOLD,
                imgsz=imgsz,
                verbose=False
            )

            for r in results:
                for box in r.boxes:
                    class_id = int(box.cls[0])
                    confidence_val = float(box.conf[0])
                    raw_class_name = self.raw_model_classes.get(class_id, str(class_id))

                    # Raw detection and threshold logging (Requirements 3 & 4)
                    print(
                        f"[YOLO DEBUG] RAW MODEL DETECTION: class_id={class_id}, "
                        f"class_name='{raw_class_name}', confidence={confidence_val:.3f}",
                        flush=True
                    )
                    print(
                        f"[YOLO DEBUG] Threshold: {conf:.2f}, Result: {'ACCEPTED' if confidence_val >= conf else 'REJECTED'}",
                        flush=True
                    )

                    # 1. Strict confidence check
                    if confidence_val < conf:
                        continue

                    # 2. Strict capability & whitelist check
                    if class_id not in self.class_id_to_allowed:
                        # Non-allowed class detected (e.g. Lion, person, dog, car, etc.)
                        print(
                            f"[YOLO DEBUG] FILTER RESULT: REJECTED (class '{raw_class_name}' ID {class_id} is not in ALLOWED_WILDLIFE)",
                            flush=True
                        )
                        continue

                    allowed_info = self.class_id_to_allowed[class_id]
                    canonical_name = allowed_info["canonical"]

                    # 3. Strict 4-class target species enforcement (STEP 1 & STEP 8)
                    from temporal_safety import ALLOWED_CANONICAL_TARGETS, BoundingBoxQualityFilter
                    if canonical_name not in ALLOWED_CANONICAL_TARGETS:
                        print(
                            f"[YOLO DEBUG] FILTER RESULT: REJECTED (canonical '{canonical_name}' not in strict 4-target species allowlist)",
                            flush=True
                        )
                        continue

                    # 4. Bounding Box Quality Filter (STEP 13: Reject tiny boxes & abnormal geometry)
                    coords = [round(float(c), 1) for c in box.xyxy[0].tolist()]
                    is_valid_box, reject_reason = BoundingBoxQualityFilter.is_valid_box(coords, frame_bgr.shape)
                    if not is_valid_box:
                        print(
                            f"[YOLO DEBUG] FILTER RESULT: REJECTED BBOX QUALITY ({reject_reason})",
                            flush=True
                        )
                        continue

                    print(
                        f"[YOLO DEBUG] FILTER RESULT: ALLOWED -> {canonical_name} ({confidence_val * 100:.1f}%)",
                        flush=True
                    )

                    detections.append({
                        "species": canonical_name,
                        "class_name": raw_class_name,
                        "class_id": class_id,
                        "key": allowed_info["key"],
                        "confidence": round(confidence_val * 100, 1),
                        "bbox": coords,
                        "emoji": allowed_info.get("emoji", "🐾"),
                        "hazard_score": allowed_info.get("hazard_score", 50.0)
                    })

            # Sort by confidence descending
            detections.sort(key=lambda d: d["confidence"], reverse=True)

        except Exception as e:
            logger.error("[YOLO] Frame inference error: %s", e, exc_info=True)

        return detections


# Global Singleton accessor
def get_detection_service() -> DetectionService:
    return DetectionService()
