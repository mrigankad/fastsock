# Import all the models, so that Base has them before being
# imported by Alembic
from app.db.base_class import Base  # noqa
from app.models.user import User  # noqa
from app.models.message import Message  # noqa
from app.models.chat import ChatRoom  # noqa
from app.models.call import CallSession  # noqa
