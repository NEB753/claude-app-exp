"""Studio: a mobile-friendly front end for ComfyUI.

Drop this folder into ComfyUI/custom_nodes/ and restart ComfyUI. The app is
then served by ComfyUI itself at  http://<comfy-host>:<port>/studio
(same origin as the ComfyUI API, so no CORS setup is needed).

It adds no nodes; it only registers static web routes.
"""

import logging
import os

from aiohttp import web

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

STUDIO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "studio")

try:
    from server import PromptServer

    routes = PromptServer.instance.routes

    @routes.get("/studio")
    async def _studio_root(request):
        raise web.HTTPFound("/studio/")

    @routes.get("/studio/")
    async def _studio_index(request):
        resp = web.FileResponse(os.path.join(STUDIO_DIR, "index.html"))
        resp.headers["Cache-Control"] = "no-cache"
        return resp

    routes.static("/studio", STUDIO_DIR)
    logging.info("[Studio] app available at /studio")
except Exception as e:  # pragma: no cover - only runs inside ComfyUI
    logging.warning(f"[Studio] could not register routes: {e}")
