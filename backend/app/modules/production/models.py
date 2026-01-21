from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.base import Base


class Script(Base):
    """
    Script model for storing uploaded script files and their metadata.
    Represents the source material for production breakdown.
    """
    __tablename__ = "scripts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    content_text = Column(Text, nullable=False)  # Full script text content
    file_url = Column(String(500))  # Supabase Storage URL for original file
    processed = Column(Boolean, default=False)  # Whether AI breakdown has been completed

    # Metadata
    file_name = Column(String(255))
    file_size_bytes = Column(Integer)
    mime_type = Column(String(100))

    # User tracking
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    updated_by = Column(String, ForeignKey("users.id"))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    processed_at = Column(DateTime(timezone=True))

    # Relationships
    scenes = relationship("Scene", back_populates="script", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Script(id={self.id}, title={self.title}, processed={self.processed})>"


class Scene(Base):
    """
    Scene model for storing individual scenes extracted from scripts.
    Contains scene metadata and breakdown information.
    """
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, index=True)
    script_id = Column(Integer, ForeignKey("scripts.id"), nullable=False)

    # Scene identification
    scene_number = Column(String(50), nullable=False, index=True)  # e.g., "1A", "EXT-001"
    heading = Column(String(255), nullable=False)  # INT/EXT LOCATION - TIME

    # Scene content
    description = Column(Text, nullable=False)
    time_of_day = Column(String(50))  # DAY, NIGHT, DAWN, DUSK, etc.
    location = Column(String(255))  # Specific location details

    # Production metadata
    estimated_duration_minutes = Column(Integer)  # Estimated shooting time
    complexity_level = Column(String(50))  # LOW, MEDIUM, HIGH, VERY_HIGH

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    script = relationship("Script", back_populates="scenes")
    breakdown_items = relationship("BreakdownItem", back_populates="scene", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Scene(id={self.id}, number={self.scene_number}, heading={self.heading})>"


class BreakdownItem(Base):
    """
    BreakdownItem model for storing elements extracted from scenes.
    Contains cast, props, vehicles, locations, and other production elements.
    """
    __tablename__ = "breakdown_items"

    id = Column(Integer, primary_key=True, index=True)
    scene_id = Column(Integer, ForeignKey("scenes.id"), nullable=False)

    # Item classification
    category = Column(String(100), nullable=False, index=True)  # CAST, PROP, VEHICLE, LOCATION, etc.
    subcategory = Column(String(100))  # More specific classification

    # Item details
    name = Column(String(255), nullable=False, index=True)  # Character name, prop description, etc.
    description = Column(Text)  # Additional details

    # Quantity and usage
    quantity = Column(Integer, default=1)
    usage_type = Column(String(50))  # HERO, BACKGROUND, STUNT, etc.

    # Production notes
    special_requirements = Column(Text)  # Special makeup, rigging, etc.
    preparation_notes = Column(Text)

    # Status
    is_confirmed = Column(Boolean, default=False)  # Whether item is confirmed for production
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    scene = relationship("Scene", back_populates="breakdown_items")

    def __repr__(self):
        return f"<BreakdownItem(id={self.id}, category={self.category}, name={self.name})>"


# Predefined categories for breakdown items
BREAKDOWN_CATEGORIES = {
    "CAST": ["ACTOR", "ACTRESS", "STUNT_PERSON", "EXTRA", "CHILD_ACTOR"],
    "CREW": ["DIRECTOR", "CAMERA_OPERATOR", "SOUND_ENGINEER", "GRIP", "GAFFER"],
    "PROPS": ["HAND_PROP", "SET_DRESSING", "SPECIAL_EFFECT", "ANIMAL", "VEHICLE"],
    "WARDROBE": ["COSTUME", "MAKEUP", "HAIR", "ACCESSORY"],
    "EQUIPMENT": ["CAMERA", "LIGHTS", "SOUND", "GRIPS", "ELECTRICAL"],
    "LOCATIONS": ["INTERIOR", "EXTERIOR", "STUDIO", "LOCATION_SPECIFIC"],
    "VEHICLES": ["CAR", "TRUCK", "MOTORCYCLE", "BICYCLE", "BOAT", "AIRCRAFT"],
    "ANIMALS": ["DOG", "CAT", "HORSE", "BIRD", "OTHER"],
    "SPECIAL_EFFECTS": ["PYROTECHNICS", "WATER", "SMOKE", "EXPLOSIONS", "CGI"],
}