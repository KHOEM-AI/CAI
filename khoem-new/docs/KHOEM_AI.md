KHOEM_AI 3.3 PRO — NEXUS MASTER DASHBOARD
​PROJECT OVERVIEW
​KHOEM_AI 3.3 PRO is an advanced, production-ready AI master dashboard designed for seamless multi-modal interaction, integrating real-time chat, voice synthesis/recognition, computer vision, GPS tracking, live map navigation, and global time management.
​CORE FEATURES & MODULES
​Command Center: Centralized interface for quick system toggles, voice assistants, and accessibility preferences.
​Voice Assistant & Speech: Integrated browser speech recognition and custom text-to-speech configuration with voice profile selection.
​Vision & Camera Support: Live photo capture, file uploading, instant image previewing, and backend vision querying.
​GPS & Navigation Engine: Real-time geolocation tracking, Leaflet map rendering, geocoding search, route calculation, and saved destination management.
​Global Time & Country Selector: Multi-timezone synchronization supporting multiple international cities and regions.
​Accessibility & View Controls: Magnifying glass view, zoom scaling, interface rotation, and custom display themes.
​SYSTEM ARCHITECTURE & LAYOUT
​Responsive Bento Grid / Standard Layout: Optimized layouts for desktop, tablet, and mobile displays using modern CSS Grid and Flexbox.
​Styling & Typography: Dark-themed aesthetic utilizing custom CSS variables, paired with Noto Sans Khmer and Inter Google fonts for high readability.
​Frontend-Backend Integration: Connects seamlessly with Flask or Python-based backend APIs via asynchronous fetch requests.
​JAVASCRIPT MODULE DEPENDENCIES
​static/js/settings.js: Manages user preferences and session states.
​static/js/voice.js: Handles speech recognition and voice output synthesis.
​static/js/gps.js: Fetches and tracks user geolocation coordinates.
​static/js/map.js: Controls Leaflet map rendering, geocoding, and route drawing.
​static/js/camera.js: Manages image capture and base64 file conversion.
​static/js/navigator.js: Handles active turn-by-turn navigation updates.
​static/js/magnifying_glass.js: Provides visual zoom and inspection utilities.
​static/js/video_khoemai.js: Supports video processing pipelines.
​static/js/khoem_ai_nexus_hub.js: Integrates core nexus hub components.
​static/js/khoemai.js: Powers the global time and country selection widget.
​API ECOSYSTEM ENDPOINTS
​POST /api/chat: Transmits user text messages and session identifiers to the core intelligence model.
​POST /api/vision: Sends encoded base64 image assets alongside prompts for visual analysis.
​GET /api/status: Verifies system operational health and sub-service connections.
​POST /api/places: Saves custom geographical waypoints (e.g., home, work) to the active session.
​GET /api/places/{session_id}/{label}: Retrieves stored location coordinates by label.
