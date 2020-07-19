from flask_login import UserMixin
from katago_gui import db, login_manager, bcrypt
from pdb import set_trace as BP

class User(UserMixin):
    def __init__( self, email):
        self.valid = True
        rows = db.find( 't_user', 'email', email)
        if not rows:
            self.valid = False
            return
        self.data = rows[0]
        self.id = self.data['email']

    def create( self, data):
        self.data = data
        db.insert( 't_user', (data,))
        self.valid = True

    def auth( self, passwd_hash):
        return bcrypt.check_password_hash( self.data['password'], passwd_hash)

# flask_login needs this callback
@login_manager.user_loader
def load_user( email):
    user = User( email)
    if not user.valid:
        return None
    return user
