from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.crud import CRUDBase
from app.core.supabase import get_supabase_client
from .models import Script, Scene, BreakdownItem
from .ai_adapter import script_analyzer
from .schemas import (
    ScriptCreate,
    ScriptRead,
    SceneRead,
    BreakdownItemRead,
    ScriptFilter,
    SceneFilter,
    BreakdownItemFilter
)


class ScriptService(CRUDBase[Script, ScriptCreate, Any]):
    """Service for script management operations."""

    def __init__(self):
        super().__init__(Script)

    async def create_script_with_file(
        self,
        db: AsyncSession,
        title: str,
        content_text: str,
        file_name: str,
        file_size: int,
        mime_type: str,
        created_by: str
    ) -> Script:
        """
        Create a new script with file upload to Supabase Storage.

        Args:
            db: Database session
            title: Script title
            content_text: Full script text content
            file_name: Original file name
            file_size: File size in bytes
            mime_type: File MIME type
            created_by: User ID who uploaded

        Returns:
            Created script instance
        """
        # Upload file to Supabase Storage (placeholder - implement actual upload)
        file_url = None  # TODO: Implement file upload to Supabase Storage

        script_data = {
            "title": title,
            "content_text": content_text,
            "file_url": file_url,
            "file_name": file_name,
            "file_size_bytes": file_size,
            "mime_type": mime_type,
            "created_by": created_by,
            "processed": False
        }

        return await self.create(db=db, obj_in=script_data)

    async def get_script_with_scenes(
        self,
        db: AsyncSession,
        script_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get script with all its scenes and breakdown items.

        Args:
            db: Database session
            script_id: Script ID

        Returns:
            Script data with nested scenes and breakdown items
        """
        # Get script
        script = await self.get(db=db, id=script_id)
        if not script:
            return None

        # Get scenes with breakdown items
        result = await db.execute(
            select(Scene).where(Scene.script_id == script_id)
        )
        scenes = result.scalars().all()

        # Get breakdown items for all scenes
        scene_ids = [scene.id for scene in scenes]
        if scene_ids:
            result = await db.execute(
                select(BreakdownItem).where(BreakdownItem.scene_id.in_(scene_ids))
            )
            breakdown_items = result.scalars().all()

            # Group breakdown items by scene
            items_by_scene = {}
            for item in breakdown_items:
                if item.scene_id not in items_by_scene:
                    items_by_scene[item.scene_id] = []
                items_by_scene[item.scene_id].append(item)

            # Attach items to scenes
            for scene in scenes:
                scene.breakdown_items = items_by_scene.get(scene.id, [])

        return {
            "script": script,
            "scenes": scenes,
            "total_scenes": len(scenes),
            "total_breakdown_items": sum(len(scene.breakdown_items) for scene in scenes)
        }


class BreakdownService:
    """Service for AI-powered script breakdown operations."""

    def __init__(self):
        self.script_service = ScriptService()

    async def process_script_breakdown(
        self,
        db: AsyncSession,
        script_id: int,
        force_reprocess: bool = False
    ) -> Dict[str, Any]:
        """
        Process script with AI and save breakdown results.

        Args:
            db: Database session
            script_id: Script ID to process
            force_reprocess: Whether to reprocess already processed scripts

        Returns:
            Processing results with created scenes and items

        Raises:
            ValueError: If script not found or already processed
        """
        # Get script
        script = await self.script_service.get(db=db, id=script_id)
        if not script:
            raise ValueError("Script not found")

        if script.processed and not force_reprocess:
            raise ValueError("Script already processed. Use force_reprocess=True to reprocess.")

        try:
            # Analyze script with AI
            analysis_result = await script_analyzer.analyze_script_text(script.content_text)

            # Save breakdown data in transaction
            created_scenes, created_items = await self._save_breakdown_data(
                db=db,
                script_id=script_id,
                analysis_data=analysis_result
            )

            # Update script status
            await db.execute(
                update(Script)
                .where(Script.id == script_id)
                .values(
                    processed=True,
                    processed_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
            )
            await db.commit()

            return {
                "script_id": script_id,
                "scenes_created": len(created_scenes),
                "breakdown_items_created": len(created_items),
                "processing_status": "completed"
            }

        except Exception as e:
            await db.rollback()
            raise Exception(f"Script breakdown failed: {str(e)}")

    async def _save_breakdown_data(
        self,
        db: AsyncSession,
        script_id: int,
        analysis_data: Dict[str, Any]
    ) -> tuple[List[Scene], List[BreakdownItem]]:
        """
        Save analyzed breakdown data to database.

        Args:
            db: Database session
            script_id: Script ID
            analysis_data: AI analysis results

        Returns:
            Tuple of (created_scenes, created_breakdown_items)
        """
        scenes_data = analysis_data.get("scenes", [])
        created_scenes = []
        created_items = []

        for scene_data in scenes_data:
            # Create scene
            scene = Scene(
                script_id=script_id,
                scene_number=scene_data["number"],
                heading=scene_data["heading"],
                description=scene_data["description"],
                time_of_day=scene_data.get("time"),
                location=scene_data.get("location")
            )

            db.add(scene)
            await db.flush()  # Get scene ID

            created_scenes.append(scene)

            # Create breakdown items for this scene
            breakdown_items = scene_data.get("breakdown_items", [])
            for item_data in breakdown_items:
                breakdown_item = BreakdownItem(
                    scene_id=scene.id,
                    category=item_data["category"],
                    name=item_data["name"],
                    description=item_data.get("description"),
                    quantity=item_data.get("quantity", 1),
                    usage_type=item_data.get("usage_type", "ATMOSPHERE")
                )

                db.add(breakdown_item)
                created_items.append(breakdown_item)

        await db.commit()
        return created_scenes, created_items

    async def get_breakdown_statistics(
        self,
        db: AsyncSession,
        script_id: int
    ) -> Dict[str, Any]:
        """
        Get breakdown statistics for a script.

        Args:
            db: Database session
            script_id: Script ID

        Returns:
            Statistics dictionary
        """
        # Count scenes
        result = await db.execute(
            select(Scene.id).where(Scene.script_id == script_id)
        )
        scene_count = len(result.scalars().all())

        # Count breakdown items by category
        result = await db.execute(
            select(BreakdownItem.category, BreakdownItem.id)
            .where(BreakdownItem.scene_id.in_(
                select(Scene.id).where(Scene.script_id == script_id)
            ))
        )

        category_counts = {}
        total_items = 0
        for category, item_id in result:
            category_counts[category] = category_counts.get(category, 0) + 1
            total_items += 1

        return {
            "script_id": script_id,
            "total_scenes": scene_count,
            "total_breakdown_items": total_items,
            "items_by_category": category_counts
        }


# Service instances
script_service = ScriptService()
breakdown_service = BreakdownService()