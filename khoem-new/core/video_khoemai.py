# ==============================================================================
# KHOEM_AI 3.0
# File    : core/video_khoemai.py
# Module  : Video AI Engine
# Version : 1.0.0
# Author  : KHOEM SOKSIVUTHA
# ==============================================================================
# Description:
# Backend engine for AI video generation.
# Handles video requests, quota, billing, history and API endpoints.
# ==============================================================================

from __future__ import annotations

import os
import uuid
import json
import shutil
from datetime import datetime
from pathlib import Path

from flask import Blueprint, jsonify, request

# ==============================================================================
# Configuration
# ==============================================================================

VIDEO_BLUEPRINT = Blueprint("video_khoemai", __name__)

APP_NAME = "KHOEM_AI"
MODULE_NAME = "Video AI Engine"
VERSION = "1.0.0"

MAX_VIDEO_DURATION = 360          # 6 minutes
FREE_VIDEO_LIMIT = 5              # videos per day
SUPPORTED_FORMATS = ("mp4",)

BASE_DIR = Path(__file__).resolve().parent.parent
VIDEO_DIR = BASE_DIR / "storage" / "videos"
HISTORY_FILE = BASE_DIR / "storage" / "videos" / "history.json"

VIDEO_DIR.mkdir(parents=True, exist_ok=True)

# ==============================================================================
# Helper Functions
# ==============================================================================

def current_time() -> str:
    """Return current UTC timestamp."""
    return datetime.utcnow().isoformat()


def generate_video_id() -> str:
    """Generate unique video id."""
    return f"video_{uuid.uuid4().hex[:12]}"


def success_response(**kwargs):
    """Standard success response."""
    data = {
        "success": True,
        "timestamp": current_time()
    }
    data.update(kwargs)
    return jsonify(data)


def error_response(message: str, status_code: int = 400):
    """Standard error response."""
    return jsonify({
        "success": False,
        "message": message,
        "timestamp": current_time()
    
    }), status_code

# ==============================================================================
# History Manager
# ==============================================================================

def load_history() -> list:
    """Load video history."""

    if not HISTORY_FILE.exists():
        return []

    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception:
        return []


def save_history(history: list) -> None:
    """Save video history."""

    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(HISTORY_FILE, "w", encoding="utf-8") as file:
        json.dump(history, file, indent=4, ensure_ascii=False)


def add_history(item: dict) -> None:
    """Add a new history record."""

    history = load_history()
    history.insert(0, item)
    save_history(history)


# ==============================================================================
# Video Metadata
# ==============================================================================

def build_video_metadata(
    video_id: str,
    prompt: str,
    duration: int,
    filename: str,
    status: str = "processing"
) -> dict:
    """Create video metadata."""

    return {
        "video_id": video_id,
        "prompt": prompt,
        "duration": duration,
        "filename": filename,
        "status": status,
        "created_at": current_time()
    }


# ==============================================================================
# Quota Manager
# ==============================================================================

def get_remaining_quota() -> dict:
    """Return remaining free quota."""

    history = load_history()

    today = datetime.utcnow().date()

    today_count = sum(
        1
        for item in history
        if datetime.fromisoformat(
            item["created_at"]
        ).date() == today
    )

    remaining = max(
        FREE_VIDEO_LIMIT - today_count,
        0
    )

    return {
        "daily_limit": FREE_VIDEO_LIMIT,
        "used_today": today_count,
        "remaining": remaining
    }


def quota_available() -> bool:
    """Check free quota."""

    return get_remaining_quota()["remaining"] > 0


# ==============================================================================
# Storage Helper
# ==============================================================================

def video_path(filename: str) -> Path:
    """Return full video path."""

    return VIDEO_DIR / filename


def video_exists(filename: str) -> bool:
    """Check whether video exists."""

    return video_path(filename).exists()


def delete_video(filename: str) -> bool:
    """Delete a stored video."""

    path = video_path(filename)

    if not path.exists():
        return False

    path.unlink()

    return True

# ==============================================================================
# Video Generator Engine
# ==============================================================================

def create_video(prompt: str, duration: int) -> dict:
    """Create a new video generation task."""

    if not prompt.strip():
        return {
            "success": False,
            "message": "Prompt is required."
        }

    if duration <= 0:
        return {
            "success": False,
            "message": "Invalid duration."
        }

    if duration > MAX_VIDEO_DURATION:
        return {
            "success": False,
            "message": "Maximum duration is 6 minutes."
        }

    if not quota_available():
        return {
            "success": False,
            "message": "Daily free limit reached."
        }

    video_id = generate_video_id()
    filename = f"{video_id}.mp4"

    metadata = build_video_metadata(
        video_id=video_id,
        prompt=prompt,
        duration=duration,
        filename=filename,
        status="processing"
    )

    add_history(metadata)

    return {
        "success": True,
        "video_id": video_id,
        "filename": filename,
        "status": "processing"
    }


# ==============================================================================
# API : Generate Video
# ==============================================================================

@VIDEO_BLUEPRINT.route("/api/video/generate", methods=["POST"])
def generate_video():

    data = request.get_json(silent=True) or {}

    prompt = data.get("prompt", "").strip()
    duration = int(data.get("duration", 60))

    result = create_video(
        prompt=prompt,
        duration=duration
    )

    if not result["success"]:
        return error_response(result["message"])

    quota = get_remaining_quota()

    return success_response(
        message="Video generation started.",
        video_id=result["video_id"],
        filename=result["filename"],
        status=result["status"],
        duration=duration,
        remaining_free=quota["remaining"]
    )

# ==============================================================================
# API : Video History
# ==============================================================================

@VIDEO_BLUEPRINT.route("/api/video/history", methods=["GET"])
def get_video_history():
    """Return all generated videos."""

    history = load_history()

    return success_response(
        total=len(history),
        history=history
    )


# ==============================================================================
# API : Video Information
# ==============================================================================

@VIDEO_BLUEPRINT.route("/api/video/info/<video_id>", methods=["GET"])
def get_video_info(video_id: str):
    """Return information for one video."""

    history = load_history()

    for item in history:
        if item["video_id"] == video_id:
            return success_response(video=item)

    return error_response(
        "Video not found.",
        404
    )


# ==============================================================================
# API : Delete Video
# ==============================================================================

@VIDEO_BLUEPRINT.route(
    "/api/video/delete/<video_id>",
    methods=["DELETE"]
)
def delete_video_api(video_id: str):
    """Delete a video."""

    history = load_history()

    target = None

    for item in history:
        if item["video_id"] == video_id:
            target = item
            break

    if target is None:
        return error_response(
            "Video not found.",
            404
        )

    if video_exists(target["filename"]):
        delete_video(target["filename"])

    history.remove(target)

    save_history(history)

    return success_response(
        message="Video deleted successfully.",
        video_id=video_id
    )


# ==============================================================================
# API : Video Status
# ==============================================================================

@VIDEO_BLUEPRINT.route(
    "/api/video/status/<video_id>",
    methods=["GET"]
)
def video_status(video_id: str):
    """Return processing status."""

    history = load_history()

    for item in history:
        if item["video_id"] == video_id:

            return success_response(
                video_id=item["video_id"],
                status=item["status"],
                created_at=item["created_at"]
            )

    return error_response(
        "Video not found.",
        404
    )


# ==============================================================================
# API : Search Video
# ==============================================================================

@VIDEO_BLUEPRINT.route(
    "/api/video/search",
    methods=["GET"]
)
def search_video():
    """Search videos by prompt."""

    keyword = request.args.get(
        "keyword",
        ""
    ).lower()

    history = load_history()

    results = [
        item
        for item in history
        if keyword in item["prompt"].lower()
    ]

    return success_response(
        total=len(results),
        results=results
    )


# ==============================================================================
# API : Video Statistics
# ==============================================================================

@VIDEO_BLUEPRINT.route(
    "/api/video/statistics",
    methods=["GET"]
)
def video_statistics():
    """Return video statistics."""

    history = load_history()

    total_videos = len(history)

    total_minutes = sum(
        item["duration"]
        for item in history
    )

    quota = get_remaining_quota()

    return success_response(
        total_videos=total_videos,
        total_duration_seconds=total_minutes,
        daily_limit=quota["daily_limit"],
        remaining_free=quota["remaining"]
    )

# ==============================================================================
# Video Processing Queue
# ==============================================================================

VIDEO_QUEUE = {}

VIDEO_PROGRESS = {}


def enqueue_video(video_id: str) -> None:
    """Add video to processing queue."""

    VIDEO_QUEUE[video_id] = {
        "status": "queued",
        "progress": 0,
        "started_at": current_time()
    }

    VIDEO_PROGRESS[video_id] = 0


def update_progress(
    video_id: str,
    progress: int,
    status: str = "processing"
) -> None:
    """Update video progress."""

    if video_id not in VIDEO_QUEUE:
        return

    progress = max(0, min(progress, 100))

    VIDEO_QUEUE[video_id]["progress"] = progress
    VIDEO_QUEUE[video_id]["status"] = status

    VIDEO_PROGRESS[video_id] = progress


def finish_video(video_id: str) -> None:
    """Mark video as completed."""

    update_progress(
        video_id,
        100,
        "completed"
    )


def cancel_video(video_id: str) -> bool:
    """Cancel processing."""

    if video_id not in VIDEO_QUEUE:
        return False

    VIDEO_QUEUE[video_id]["status"] = "cancelled"

    return True


# ==============================================================================
# API : Progress
# ==============================================================================

@VIDEO_BLUEPRINT.route(
    "/api/video/progress/<video_id>",
    methods=["GET"]
)
def get_progress(video_id: str):

    if video_id not in VIDEO_QUEUE:
        return error_response(
            "Video not found.",
            404
        )

    item = VIDEO_QUEUE[video_id]

    return success_response(
        video_id=video_id,
        status=item["status"],
        progress=item["progress"]
    )


# ==============================================================================
# API : Cancel
# ==============================================================================

@VIDEO_BLUEPRINT.route(
    "/api/video/cancel/<video_id>",
    methods=["POST"]
)
def cancel_video_api(video_id: str):

    if not cancel_video(video_id):
        return error_response(
            "Video not found.",
            404
        )

    return success_response(
        message="Video cancelled.",
        video_id=video_id
    )


# ==============================================================================
# API : Retry
# ==============================================================================

@VIDEO_BLUEPRINT.route(
    "/api/video/retry/<video_id>",
    methods=["POST"]
)
def retry_video(video_id: str):

    if video_id not in VIDEO_QUEUE:
        return error_response(
            "Video not found.",
            404
        )

    enqueue_video(video_id)

    return success_response(
        message="Video queued again.",
        video_id=video_id
    )

# ==============================================================================
# Premium & Subscription System
# ==============================================================================

FREE_MAX_DURATION = 360          # 6 minutes
FREE_DAILY_LIMIT = 3
PREMIUM_MAX_DURATION = 1800      # 30 minutes

PREMIUM_USERS = set()


def is_premium(user_id: str) -> bool:
    """Return True if user has premium."""

    return user_id in PREMIUM_USERS


def get_user_plan(user_id: str) -> str:
    """Return user plan."""

    if is_premium(user_id):
        return "premium"

    return "free"


def check_generation_limit(
    user_id: str,
    duration: int
) -> tuple[bool, str]:

    if is_premium(user_id):

        if duration > PREMIUM_MAX_DURATION:
            return (
                False,
                "Premium limit is 30 minutes."
            )

        return (
            True,
            "Premium"
        )

    quota = get_remaining_quota()

    if quota["remaining"] <= 0:
        return (
            False,
            "Daily free quota exceeded."
        )

    if duration > FREE_MAX_DURATION:
        return (
            False,
            "Free users are limited to 6 minutes."
        )

    return (
        True,
        "Free"
    )


# ==============================================================================
# API : User Plan
# ==============================================================================

@VIDEO_BLUEPRINT.route(
    "/api/video/plan/<user_id>",
    methods=["GET"]
)
def user_plan(user_id: str):

    return success_response(
        user_id=user_id,
        plan=get_user_plan(user_id)
    )


# ==============================================================================
# API : Upgrade
# ==============================================================================

@VIDEO_BLUEPRINT.route(
    "/api/video/upgrade",
    methods=["POST"]
)
def upgrade_account():

    data = request.get_json(silent=True) or {}

    user_id = data.get("user_id", "").strip()

    if not user_id:
        return error_response(
            "User ID required."
        )

    PREMIUM_USERS.add(user_id)

    return success_response(
        message="Premium activated.",
        user_id=user_id
    )


# ==============================================================================
# API : Subscription Status
# ==============================================================================

@VIDEO_BLUEPRINT.route(
    "/api/video/subscription/<user_id>",
    methods=["GET"]
)
def subscription_status(user_id: str):

    return success_response(
        user_id=user_id,
        premium=is_premium(user_id),
        max_duration=(
            PREMIUM_MAX_DURATION
            if is_premium(user_id)
            else FREE_MAX_DURATION
        ),
        daily_limit=(
            "Unlimited"
            if is_premium(user_id)
            else FREE_DAILY_LIMIT
        )
    )


# ==============================================================================
# API : Pricing
# ==============================================================================

@VIDEO_BLUEPRINT.route(
    "/api/video/pricing",
    methods=["GET"]
)
def pricing():

    return success_response(
        free={
            "duration": "6 minutes",
            "daily_limit": FREE_DAILY_LIMIT
        },
        premium={
            "duration": "30 minutes",
            "daily_limit": "Unlimited"
        }
    )

# ==============================================================================
# Final Configuration
# ==============================================================================

def register_video_module(app):
    """Register Video Blueprint."""

    app.register_blueprint(VIDEO_BLUEPRINT)

    logger.info(
        "Video Module Registered."
    )


# ==============================================================================
# Health Check
# ==============================================================================

@VIDEO_BLUEPRINT.route(
    "/api/video/health",
    methods=["GET"]
)
def video_health():

    return success_response(
        module="video_khoemai",
        version="1.0.0",
        status="online"
    )


# ==============================================================================
# Configuration
# ==============================================================================

VIDEO_CONFIGURATION = {

    "module": "video_khoemai",

    "version": "1.0.0",

    "author": "KHOEM SOKSIVUTHA",

    "engine": "KHOEM_AI Video",

    "default_format": "mp4",

    "default_resolution": "1280x720",

    "max_free_duration": FREE_MAX_DURATION,

    "max_premium_duration": PREMIUM_MAX_DURATION

}


# ==============================================================================
# Logging
# ==============================================================================

def log_video_event(
    event: str,
    video_id: str = "",
    message: str = ""
):

    logger.info(

        "[VIDEO] %s | %s | %s",

        event,

        video_id,

        message

    )


# ==============================================================================
# Error Handler
# ==============================================================================

@VIDEO_BLUEPRINT.errorhandler(Exception)
def handle_video_error(error):

    logger.exception(error)

    return error_response(

        message="Video module error.",

        status_code=500

    )


# ==============================================================================
# Export
# ==============================================================================

__all__ = [

    "VIDEO_BLUEPRINT",

    "register_video_module",

    "generate_video",

    "load_history",

    "save_history",

    "video_exists",

    "delete_video",

    "enqueue_video",

    "update_progress",

    "finish_video",

    "cancel_video"

]


# ==============================================================================
# Startup
# ==============================================================================

logger.info("=" * 60)
logger.info("KHOEM_AI Video Module")
logger.info("Version : 1.0.0")
logger.info("Status  : READY")
logger.info("=" * 60)

# ==============================================================================
# Health Check
# ==============================================================================

@VIDEO_BLUEPRINT.route(
    "/api/video/health",
    methods=["GET"]
)
def video_health():

    return success_response(
        service="video_khoemai",
        version="1.0.0",
        status="online"
    )


# ==============================================================================
# Configuration
# ==============================================================================

VIDEO_CONFIG = {

    "service_name": "KHOEM_AI Video Engine",

    "version": "1.0.0",

    "max_upload_size": 1024 * 1024 * 50,

    "allowed_formats": [

        "mp4",

        "mov",

        "webm"

    ],

    "image_formats": [

        "jpg",

        "jpeg",

        "png",

        "webp"

    ]

}


# ==============================================================================
# Startup
# ==============================================================================

def initialize_video_engine():

    logger.info(
        "Initializing Video Engine..."
    )

    ensure_storage()

    ensure_history()

    logger.info(
        "Video Engine Ready."
    )


# ==============================================================================
# Register Blueprint
# ==============================================================================

def register_video_engine(app):

    initialize_video_engine()

    app.register_blueprint(
        VIDEO_BLUEPRINT
    )

    logger.info(
        "Video Blueprint Registered."
    )


# ==============================================================================
# Information
# ==============================================================================

def engine_information():

    return {

        "name": VIDEO_CONFIG["service_name"],

        "version": VIDEO_CONFIG["version"],

        "formats": VIDEO_CONFIG["allowed_formats"],

        "image_formats": VIDEO_CONFIG["image_formats"]

    }


# ==============================================================================
# Export
# ==============================================================================

__all__ = [

    "VIDEO_BLUEPRINT",

    "register_video_engine",

    "engine_information",

    "generate_video",

    "load_history",

    "save_history"

]


# ==============================================================================
# End
# ==============================================================================

logger.info(
    "video_khoemai.py loaded successfully."
)
