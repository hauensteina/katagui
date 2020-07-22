import json
from flask_login import UserMixin
from katago_gui import db, login_manager, bcrypt
from pdb import set_trace as BP

class User(UserMixin):
    def __init__( self, email):
        self.valid = True
        self.id = email.strip().lower()
        self.data = {}
        rows = db.find( 't_user', 'email', self.id)
        if not rows:
            self.valid = False
            return
        self.data = rows[0]

    def create( self, data):
        self.data = data
        self.data['email'] = self.data['email'].strip().lower()
        self.data['fname'] = self.data['fname'].strip()
        self.data['lname'] = self.data['lname'].strip()
        self.data['username'] = self.data['username'].strip()
        db.insert( 't_user', (data,))
        self.valid = True

    def auth( self, passwd_hash):
        return bcrypt.check_password_hash( self.data['password'], passwd_hash)

    def json( self):
        jjson = self.data.get( 'json', '{}')
        if jjson == 'null': jjson = '{}'
        return json.loads( jjson)

    def email_verified( self):
        jjson = self.json()
        return jjson.get('email_verified', False)

# flask_login needs this callback
@login_manager.user_loader
def load_user( email):
    user = User( email)
    if not user.valid:
        return None
    elif not user.email_verified():
        return None
    return user
