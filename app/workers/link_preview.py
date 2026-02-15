"""
Background link-preview fetcher.
Called after a message is saved; detects URLs, fetches OG metadata,
persists to link_preview table, and pushes a WS event to participants.
"""
from __future__ import annotations
import re
import asyncio
import logging
from typing import Optional

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.message import LinkPreview
from app.schemas.ws_events import WSEvent
from app.ws.manager import manager

logger = logging.getLogger(__name__)

# Simple URL regex — good enough for chat messages
_URL_RE = re.compile(
    r"https?://[^\s\"'<>()]{4,}",
    re.IGNORECASE,
)
_TIMEOUT = httpx.Timeout(5.0)
_HEADERS = {"User-Agent": "FastSock/1.0 LinkPreviewBot"}


def extract_first_url(text: str) -> Optional[str]:
    m = _URL_RE.search(text)
    return m.group(0) if m else None


async def fetch_og(url: str) -> Optional[dict]:
    """Fetch OG/meta tags from a URL. Returns None on any error."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True, headers=_HEADERS) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            ct = resp.headers.get("content-type", "")
            if "html" not in ct:
                return None
            soup = BeautifulSoup(resp.text, "html.parser")

            def og(prop: str) -> Optional[str]:
                tag = soup.find("meta", property=f"og:{prop}") or soup.find("meta", attrs={"name": prop})
                return (tag.get("content") or "").strip() if tag else None  # type: ignore[union-attr]

            title = og("title") or (soup.title.string.strip() if soup.title else None)
            return {
                "url": url,
                "title": title,
                "description": og("description"),
                "image_url": og("image"),
                "site_name": og("site_name"),
            }
    except Exception as exc:
        logger.debug("Link preview fetch failed for %s: %s", url, exc)
        return None


async def process_message_link_preview(
    message_id: int,
    content: str,
    recipient_ids: Optional[list[int]] = None,
) -> None:
    """
    Entry point: called fire-and-forget after a message is saved.
    Detects first URL, fetches OG data, persists, and broadcasts.
    """
    url = extract_first_url(content)
    if not url:
        return

    og = await fetch_og(url)
    if not og or not og.get("title"):
        return

    async with AsyncSessionLocal() as db:
        # Avoid duplicates
        existing = (await db.execute(
            select(LinkPreview).where(LinkPreview.message_id == message_id)
        )).scalar_one_or_none()
        if existing:
            return

        preview = LinkPreview(
            message_id=message_id,
            url=og["url"],
            title=og.get("title"),
            description=og.get("description"),
            image_url=og.get("image_url"),
            site_name=og.get("site_name"),
        )
        db.add(preview)
        await db.commit()
        await db.refresh(preview)

    # Push to clients
    await manager.broadcast(WSEvent(
        event="message.link_preview",
        data={
            "message_id": message_id,
            "url": preview.url,
            "title": preview.title,
            "description": preview.description,
            "image_url": preview.image_url,
            "site_name": preview.site_name,
        },
        recipient_ids=recipient_ids,
    ))


def enqueue(message_id: int, content: str, recipient_ids: Optional[list[int]] = None) -> None:
    """Fire-and-forget: schedule the fetch without blocking the caller."""
    asyncio.ensure_future(
        process_message_link_preview(message_id, content, recipient_ids)
    )
