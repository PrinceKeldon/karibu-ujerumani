from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    location: str
    is_verified: bool
    arrived_at: Optional[str] = None
    profile_photo_url: Optional[str] = None
    profile_photo_path: Optional[str] = None
    verification_status: Optional[str] = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    location: Optional[str] = None
    arrived_at: Optional[str] = None


class ProfilePhotoUpdate(BaseModel):
    profile_photo_url: str
    profile_photo_path: Optional[str] = None


class UserSettingsOut(BaseModel):
    community_replies: bool = True
    host_messages: bool = True
    event_reminders: bool = False
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserSettingsUpdate(BaseModel):
    community_replies: bool = True
    host_messages: bool = True
    event_reminders: bool = False


class VerificationRequestCreate(BaseModel):
    request_type: str = "community"
    notes: Optional[str] = None


class VerificationRequestOut(BaseModel):
    id: int
    request_type: str
    notes: Optional[str] = None
    status: str
    reviewer_notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProfileSummaryOut(BaseModel):
    saved_count: int = 0
    booking_count: int = 0
    checklist_done_count: int = 0
    post_count: int = 0
    tips_count: int = 0
    answers_count: int = 0
    support_case_count: int = 0


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class ListingCreate(BaseModel):
    title: str
    price: int
    district: str
    city_id: Optional[int] = None
    state_id: Optional[int] = None
    address: Optional[str] = None
    transit_info: Optional[str] = None
    description: Optional[str] = None
    theme: str = "sun"


class ListingOut(BaseModel):
    id: int
    title: str
    price: int
    district: str
    address: Optional[str] = None
    transit_info: Optional[str] = None
    description: Optional[str] = None
    theme: str
    rating: str
    is_top_match: bool
    host_id: Optional[int] = None
    city_id: Optional[int] = None
    state_id: Optional[int] = None
    approval_status: str = "pending"
    is_saved: bool = False

    model_config = {"from_attributes": True}


class StateOut(BaseModel):
    id: int
    name: str
    abbreviation: str
    capital_city: str
    country_code: str = "DE"

    model_config = {"from_attributes": True}


class CityOut(BaseModel):
    id: int
    name: str
    state_id: int
    latitude: float
    longitude: float
    population: Optional[int] = None
    is_tier_1: bool = False
    is_tier_2: bool = False
    is_active: bool = True
    state_name: Optional[str] = None
    state_abbreviation: Optional[str] = None
    listing_count: int = 0
    distance_km: Optional[float] = None

    model_config = {"from_attributes": True}


class RathausOfficeOut(BaseModel):
    id: int
    name: str
    office_type: str
    city_id: Optional[int] = None
    state_id: Optional[int] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    opening_hours: Optional[str] = "{}"
    appointment_url: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    is_verified: bool = False
    city_name: Optional[str] = None
    state_name: Optional[str] = None
    state_abbreviation: Optional[str] = None
    distance_km: Optional[float] = None

    model_config = {"from_attributes": True}


class RathausSearchOut(BaseModel):
    query: str
    latitude: float
    longitude: float
    label: Optional[str] = None
    offices: list[RathausOfficeOut]


class EmergencyServiceOut(BaseModel):
    id: int
    name: str
    phone: str
    description: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    map_url: Optional[str] = None
    office_hours: Optional[str] = None
    scope: str
    state_id: Optional[int] = None
    city_id: Optional[int] = None
    category: str
    available_24h: bool = True
    languages: str = "German"

    model_config = {"from_attributes": True}


class CommunityPostCreate(BaseModel):
    body: str
    tab: str = "For You"


class CommunityPostOut(BaseModel):
    id: int
    author_name: str
    author_area: str
    body: str
    tab: str
    likes: int
    comments: int
    created_at: datetime
    is_liked: bool = False

    model_config = {"from_attributes": True}


class CommunityCommentCreate(BaseModel):
    body: str


class CommunityCommentOut(BaseModel):
    id: int
    post_id: int
    author_name: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class EventCreate(BaseModel):
    title: str
    date_str: str
    location: str
    tag: str = "Community"
    is_ticketed: bool = False
    ticket_url: Optional[str] = None
    ticket_price: Optional[str] = None


class EventOut(BaseModel):
    id: int
    title: str
    date_str: str
    location: str
    rsvp_count: int
    tag: str
    is_ticketed: bool = False
    ticket_url: Optional[str] = None
    ticket_price: Optional[str] = None
    approval_status: str = "approved"
    is_rsvped: bool = False

    model_config = {"from_attributes": True}


class BookingCreate(BaseModel):
    listing_id: int
    start_date: str
    end_date: str


class BookingOut(BaseModel):
    id: int
    listing_title: str
    listing_theme: str
    start_date: str
    end_date: str
    price: int
    status: str

    model_config = {"from_attributes": True}


class ChecklistToggle(BaseModel):
    task_key: str


class MessageCreate(BaseModel):
    to_user_id: int
    body: str


class ConversationOut(BaseModel):
    name: str
    body: str
    is_read: bool
    time: str
    unread_count: int = 0


class SupportCaseCreate(BaseModel):
    case_type: str
    description: Optional[str] = None
    contact_pref: Optional[str] = None


class SupportCaseOut(BaseModel):
    id: int
    case_type: str
    case_ref: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminRoleOut(BaseModel):
    user_id: int
    role: str
    permissions: Optional[str] = "{}"

    model_config = {"from_attributes": True}


class AdminMeOut(BaseModel):
    user_id: int
    email: str
    role: str
    permissions: Optional[str] = "{}"


class AdminSummaryOut(BaseModel):
    pending_listings: int = 0
    pending_ticketed_events: int = 0
    open_support_cases: int = 0
    pending_moderator_invites: int = 0
    published_announcements: int = 0


class AdminAction(BaseModel):
    status: str
    note: Optional[str] = None


class ModeratorInviteCreate(BaseModel):
    email: EmailStr
    permissions: Optional[str] = "{}"


class ModeratorInviteOut(BaseModel):
    id: int
    email: str
    invited_by: int
    approved_by: Optional[int] = None
    status: str
    permissions: Optional[str] = "{}"
    created_at: datetime

    model_config = {"from_attributes": True}


class SupportCaseAdminOut(BaseModel):
    id: int
    user_id: int
    case_type: str
    description: Optional[str] = None
    contact_pref: Optional[str] = None
    case_ref: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SupportCaseUpdate(BaseModel):
    status: str
    note: Optional[str] = None


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    audience: str = "all"
    channel: str = "community"
    publish_now: bool = True


class AnnouncementOut(BaseModel):
    id: int
    title: str
    body: str
    audience: str
    channel: str
    status: str
    created_by: int
    published_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminAuditOut(BaseModel):
    id: int
    actor_user_id: int
    action: str
    target_type: str
    target_id: Optional[str] = None
    detail: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
