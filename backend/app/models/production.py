from sqlalchemy import Column, String, TEXT, TIMESTAMP, func, ForeignKey, Integer, Enum, Time, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.base import Base
import uuid
import enum


class DayNightEnum(enum.Enum):
    day = "day"
    night = "night"
    dawn = "dawn"
    dusk = "dusk"


class InternalExternalEnum(enum.Enum):
    internal = "internal"
    external = "external"


class Scene(Base):
    __tablename__ = "scenes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)

    scene_number = Column(Integer, nullable=False)
    heading = Column(String, nullable=False)  # e.g., "INT. COFFEE SHOP - DAY"
    description = Column(TEXT, nullable=False)
    day_night = Column(Enum(DayNightEnum), nullable=False)
    internal_external = Column(Enum(InternalExternalEnum), nullable=False)
    estimated_time_minutes = Column(Integer, nullable=False)  # Estimated shooting time in minutes

    # Optional shooting day assignment
    shooting_day_id = Column(UUID(as_uuid=True), ForeignKey("shooting_days.id"), nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="scenes")
    shooting_day = relationship("ShootingDay", back_populates="scenes")
    characters = relationship("Character", secondary="scene_characters", back_populates="scenes")

    __table_args__ = (
        {'schema': None}
    )


class Character(Base):
    __tablename__ = "characters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)

    name = Column(String, nullable=False)
    description = Column(TEXT, nullable=False)
    actor_name = Column(String, nullable=True)  # Assigned actor if casting is done

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="characters")
    scenes = relationship("Scene", secondary="scene_characters", back_populates="characters")

    __table_args__ = (
        {'schema': None}
    )


# Many-to-many relationship table
class SceneCharacter(Base):
    __tablename__ = "scene_characters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)

    scene_id = Column(UUID(as_uuid=True), ForeignKey("scenes.id"), nullable=False)
    character_id = Column(UUID(as_uuid=True), ForeignKey("characters.id"), nullable=False)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    __table_args__ = (
        {'schema': None}
    )
