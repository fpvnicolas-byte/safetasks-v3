from app.services.base import BaseService
from app.models.production import Scene, Character, SceneCharacter
from app.models.scheduling import ShootingDay
from app.schemas.production import (
    SceneCreate, SceneUpdate,
    CharacterCreate, CharacterUpdate,
    ShootingDayCreate, ShootingDayUpdate,
    ProjectBreakdown, AIScriptAnalysisCommit
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID


class SceneService(BaseService[Scene, SceneCreate, SceneUpdate]):
    """Service for Scene operations."""

    def __init__(self):
        super().__init__(Scene)

    async def _validate_project_ownership(self, db: AsyncSession, organization_id: UUID, project_id: UUID):
        """Validate that project belongs to the organization."""
        from app.modules.commercial.service import project_service
        project = await project_service.get(db=db, organization_id=organization_id, id=project_id)
        if not project:
            raise ValueError("Project not found or does not belong to your organization")
        return project

    async def _validate_shooting_day_ownership(self, db: AsyncSession, organization_id: UUID, shooting_day_id: UUID):
        """Validate that shooting day belongs to the organization."""
        shooting_day_service = ShootingDayService()
        shooting_day = await shooting_day_service.get(db=db, organization_id=organization_id, id=shooting_day_id)
        if not shooting_day:
            raise ValueError("Shooting day not found or does not belong to your organization")
        return shooting_day

    async def create(self, db, *, organization_id, obj_in):
        """Create scene with project and shooting day validation."""
        await self._validate_project_ownership(db, organization_id, obj_in.project_id)

        if obj_in.shooting_day_id:
            await self._validate_shooting_day_ownership(db, organization_id, obj_in.shooting_day_id)

        return await super().create(db=db, organization_id=organization_id, obj_in=obj_in)

    async def update(self, db, *, organization_id, id, obj_in):
        """Update scene with validation."""
        if hasattr(obj_in, 'project_id') and obj_in.project_id is not None:
            await self._validate_project_ownership(db, organization_id, obj_in.project_id)

        if hasattr(obj_in, 'shooting_day_id') and obj_in.shooting_day_id is not None:
            await self._validate_shooting_day_ownership(db, organization_id, obj_in.shooting_day_id)

        return await super().update(db=db, organization_id=organization_id, id=id, obj_in=obj_in)


class CharacterService(BaseService[Character, CharacterCreate, CharacterUpdate]):
    """Service for Character operations."""

    def __init__(self):
        super().__init__(Character)

    async def _validate_project_ownership(self, db: AsyncSession, organization_id: UUID, project_id: UUID):
        """Validate that project belongs to the organization."""
        from app.modules.commercial.service import project_service
        project = await project_service.get(db=db, organization_id=organization_id, id=project_id)
        if not project:
            raise ValueError("Project not found or does not belong to your organization")
        return project

    async def create(self, db, *, organization_id, obj_in):
        """Create character with project validation."""
        await self._validate_project_ownership(db, organization_id, obj_in.project_id)
        return await super().create(db=db, organization_id=organization_id, obj_in=obj_in)

    async def update(self, db, *, organization_id, id, obj_in):
        """Update character with project validation."""
        if hasattr(obj_in, 'project_id') and obj_in.project_id is not None:
            await self._validate_project_ownership(db, organization_id, obj_in.project_id)

        return await super().update(db=db, organization_id=organization_id, id=id, obj_in=obj_in)


class ShootingDayService(BaseService[ShootingDay, ShootingDayCreate, ShootingDayUpdate]):
    """Service for Shooting Day operations."""

    def __init__(self):
        super().__init__(ShootingDay)

    async def _validate_project_ownership(self, db: AsyncSession, organization_id: UUID, project_id: UUID):
        """Validate that project belongs to the organization."""
        from app.modules.commercial.service import project_service
        project = await project_service.get(db=db, organization_id=organization_id, id=project_id)
        if not project:
            raise ValueError("Project not found or does not belong to your organization")
        return project

    async def create(self, db, *, organization_id, obj_in):
        """Create shooting day with project validation."""
        await self._validate_project_ownership(db, organization_id, obj_in.project_id)
        return await super().create(db=db, organization_id=organization_id, obj_in=obj_in)

    async def update(self, db, *, organization_id, id, obj_in):
        """Update shooting day with project validation."""
        if hasattr(obj_in, 'project_id') and obj_in.project_id is not None:
            await self._validate_project_ownership(db, organization_id, obj_in.project_id)

        return await super().update(db=db, organization_id=organization_id, id=id, obj_in=obj_in)


class ProductionService:
    """High-level service for production operations and AI integration."""

    def __init__(self):
        self.scene_service = SceneService()
        self.character_service = CharacterService()
        self.shooting_day_service = ShootingDayService()

    async def get_project_breakdown(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        project_id: UUID
    ) -> ProjectBreakdown:
        """Get complete project breakdown with scenes, characters, and shooting days."""
        # Validate project ownership
        from app.modules.commercial.service import project_service
        project = await project_service.get(db=db, organization_id=organization_id, id=project_id)
        if not project:
            raise ValueError("Project not found or does not belong to your organization")

        # Get all entities for the project
        characters = await self.character_service.get_multi(
            db=db, organization_id=organization_id, filters={"project_id": project_id}
        )

        scenes = await self.scene_service.get_multi(
            db=db, organization_id=organization_id, filters={"project_id": project_id}
        )

        shooting_days = await self.shooting_day_service.get_multi(
            db=db, organization_id=organization_id, filters={"project_id": project_id}
        )

        return ProjectBreakdown(
            project_id=project_id,
            project_title=project.title,
            characters=characters,
            scenes=scenes,
            shooting_days=shooting_days
        )

    async def commit_ai_analysis(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        project_id: UUID,
        analysis_data: dict
    ) -> dict:
        """
        Commit AI script analysis to database.
        Creates Scene and Character records atomically.
        """
        # Validate project ownership
        from app.modules.commercial.service import project_service
        project = await project_service.get(db=db, organization_id=organization_id, id=project_id)
        if not project:
            raise ValueError("Project not found or does not belong to your organization")

        created_characters = []
        created_scenes = []
        scene_character_links = []

        # Use database transaction for atomicity
        async with db.begin():
            # Create characters first
            characters_data = analysis_data.get("characters", [])
            for char_data in characters_data:
                character = Character(
                    organization_id=organization_id,
                    project_id=project_id,
                    name=char_data["name"],
                    description=char_data["description"],
                    actor_name=char_data.get("actor_name")
                )
                db.add(character)
                await db.flush()
                created_characters.append(character)

            # Create scenes
            scenes_data = analysis_data.get("scenes", [])
            for scene_data in scenes_data:
                # Map AI output to our enum values
                day_night_map = {
                    "day": "day",
                    "night": "night",
                    "dawn": "dawn",
                    "dusk": "dusk"
                }

                internal_external_map = {
                    "INT.": "internal",
                    "EXT.": "external"
                }

                # Determine internal/external from heading
                heading = scene_data["heading"]
                internal_external = "internal"  # default
                if heading.startswith("EXT."):
                    internal_external = "external"

                scene = Scene(
                    organization_id=organization_id,
                    project_id=project_id,
                    scene_number=scene_data["number"],
                    heading=heading,
                    description=scene_data["description"],
                    day_night=day_night_map.get(scene_data.get("day_night", "day"), "day"),
                    internal_external=internal_external,
                    estimated_time_minutes=scene_data.get("estimated_time", 5)
                )
                db.add(scene)
                await db.flush()

                # Create scene-character relationships
                character_names = scene_data.get("characters", [])
                for char_name in character_names:
                    # Find character by name
                    character = next((c for c in created_characters if c.name == char_name), None)
                    if character:
                        scene_character = SceneCharacter(
                            organization_id=organization_id,
                            scene_id=scene.id,
                            character_id=character.id
                        )
                        db.add(scene_character)
                        scene_character_links.append(scene_character)

                created_scenes.append(scene)

            await db.commit()

        return {
            "characters_created": len(created_characters),
            "scenes_created": len(created_scenes),
            "relationships_created": len(scene_character_links),
            "project_id": str(project_id)
        }

    async def assign_scenes_to_shooting_day(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        shooting_day_id: UUID,
        scene_ids: List[UUID]
    ) -> dict:
        """Assign multiple scenes to a shooting day."""
        # Validate shooting day ownership
        shooting_day = await self.shooting_day_service.get(
            db=db, organization_id=organization_id, id=shooting_day_id
        )
        if not shooting_day:
            raise ValueError("Shooting day not found or does not belong to your organization")

        # Validate all scenes belong to same project and organization
        updated_count = 0
        for scene_id in scene_ids:
            scene = await self.scene_service.get(
                db=db, organization_id=organization_id, id=scene_id
            )
            if scene and scene.project_id == shooting_day.project_id:
                # Update scene's shooting day
                await self.scene_service.update(
                    db=db,
                    organization_id=organization_id,
                    id=scene_id,
                    obj_in={"shooting_day_id": shooting_day_id}
                )
                updated_count += 1

        return {
            "shooting_day_id": str(shooting_day_id),
            "scenes_assigned": updated_count,
            "project_id": str(shooting_day.project_id)
        }


# Service instances
scene_service = SceneService()
character_service = CharacterService()
shooting_day_service = ShootingDayService()
production_service = ProductionService()
