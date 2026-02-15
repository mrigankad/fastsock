# Import all the models, so that Base has them before being
# imported by Alembic
from app.db.base_class import Base  # noqa
from app.models.user import User, UserPrivacy, UserSession, UserBlock, UserContact  # noqa
from app.models.message import Message, LinkPreview, DisappearingTimer  # noqa
from app.models.chat import ChatRoom, ChatRoomMember, RoomInviteLink  # noqa
from app.models.call import CallSession  # noqa
from app.models.pins import PinnedMessage, BookmarkedMessage  # noqa
from app.models.notification import Notification  # noqa
