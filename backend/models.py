from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    location = Column(String, default="Berlin, Germany")
    arrived_at = Column(String, nullable=True)
    profile_photo_url = Column(Text, nullable=True)
    profile_photo_path = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    price = Column(Integer, nullable=False)
    district = Column(String, nullable=False)
    address = Column(String, nullable=True)
    transit_info = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    theme = Column(String, default="sun")
    rating = Column(String, default="4.5 ★")
    is_top_match = Column(Boolean, default=False)
    host_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    state_id = Column(Integer, ForeignKey("states.id"), nullable=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class State(Base):
    __tablename__ = "states"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    abbreviation = Column(String, unique=True, nullable=False)
    capital_city = Column(String, nullable=False)
    country_code = Column(String, default="DE", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class City(Base):
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    state_id = Column(Integer, ForeignKey("states.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    population = Column(Integer, nullable=True)
    is_tier_1 = Column(Boolean, default=False)
    is_tier_2 = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class RathausOffice(Base):
    __tablename__ = "rathaus_offices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    office_type = Column(String, default="buergeramt", nullable=False)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=True)
    state_id = Column(Integer, ForeignKey("states.id"), nullable=True)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    website = Column(String, nullable=True)
    email = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    opening_hours = Column(Text, default="{}")
    appointment_url = Column(String, nullable=True)
    osm_id = Column(String, unique=True, nullable=True)
    google_place_id = Column(String, nullable=True)
    source = Column(String, nullable=True)
    source_url = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class EmergencyService(Base):
    __tablename__ = "emergency_services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    website = Column(String, nullable=True)
    address = Column(String, nullable=True)
    map_url = Column(String, nullable=True)
    office_hours = Column(String, nullable=True)
    scope = Column(String, nullable=False)
    state_id = Column(Integer, ForeignKey("states.id"), nullable=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=True)
    category = Column(String, nullable=False)
    available_24h = Column(Boolean, default=True)
    languages = Column(Text, default="German")
    created_at = Column(DateTime, default=datetime.utcnow)


class SavedListing(Base):
    __tablename__ = "saved_listings"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    listing_id = Column(Integer, ForeignKey("listings.id"), primary_key=True)
    saved_at = Column(DateTime, default=datetime.utcnow)


class CommunityPost(Base):
    __tablename__ = "community_posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    author_name = Column(String, nullable=False)
    author_area = Column(String, default="Berlin")
    body = Column(Text, nullable=False)
    tab = Column(String, default="For You")
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class CommunityComment(Base):
    __tablename__ = "community_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("community_posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    author_name = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class CommunityPostLike(Base):
    __tablename__ = "community_post_likes"

    post_id = Column(Integer, ForeignKey("community_posts.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String, nullable=False)
    date_str = Column(String, nullable=False)
    location = Column(String, nullable=False)
    rsvp_count = Column(Integer, default=0)
    tag = Column(String, default="Event")
    created_at = Column(DateTime, default=datetime.utcnow)


class EventRsvp(Base):
    __tablename__ = "event_rsvps"

    event_id = Column(Integer, ForeignKey("events.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=False)
    listing_title = Column(String, nullable=False)
    listing_theme = Column(String, default="sun")
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    price = Column(Integer, nullable=False)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)


class ChecklistCompletion(Base):
    __tablename__ = "checklist_completions"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    task_key = Column(String, primary_key=True)
    completed_at = Column(DateTime, default=datetime.utcnow)


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    community_replies = Column(Boolean, default=True, nullable=False)
    host_messages = Column(Boolean, default=True, nullable=False)
    event_reminders = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow)


class VerificationRequest(Base):
    __tablename__ = "verification_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    request_type = Column(String, default="community", nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String, default="pending", nullable=False)
    reviewer_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class SupportCase(Base):
    __tablename__ = "support_cases"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    case_type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    contact_pref = Column(String, nullable=True)
    status = Column(String, default="open")
    case_ref = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    from_name = Column(String, nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
