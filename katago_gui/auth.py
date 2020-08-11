# /********************************************************************
# Filename: katago-gui/katago_gui/auth.py
# Author: AHN
# Creation Date: Aug, 2020
# **********************************************************************/
#
# Flask login with postgres
#

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

    def createdb( self, data):
        """ Create User in DB """
        self.data = data
        self.data['email'] = self.id
        self.data['username'] = self.data['username'].strip()
        self.data['password'] = ''
        self.data['fname'] = self.data['fname'].strip()
        self.data['lname'] = self.data['lname'].strip()
        self.data['lang'] = 'eng'
        rows = db.find( 't_user', 'username',  self.data['username'])
        if rows:
            return 'err_user_exists'
        rows = db.find( 't_user', 'email',  self.id)
        if rows:
            return 'err_user_exists'
        db.insert( 't_user', (data,))
        db.tstamp( 't_user', 'email', self.id, 'ts_created')
        db.tstamp( 't_user', 'email', self.id, 'ts_last_seen')
        self.read_from_db()
        self.valid = True
        return 'ok'

    def update_db( self):
        """ Write our data back to the db """
        db.update_row( 't_user', 'email', self.id, self.data)

    def read_from_db( self):
        """ Read our data from the db """
        data = db.find( 't_user', 'email', self.id)[0]
        self.data.update( data)

    def record_activity( self):
        """ Set ts_last_seen to now() """
        db.tstamp( 't_user', 'email', self.id, 'ts_last_seen')

    def password_matches( self, password):
        """ Check password """
        return bcrypt.check_password_hash( self.data['password'], password)

    def set_password( self, password):
        """ Update password """
        hashed_password = bcrypt.generate_password_hash( password).decode('utf-8')
        self.data['password'] = hashed_password
        db.update_row( 't_user', 'email', self.id, { 'password':hashed_password })

    def set_email_verified( self):
        """ Mark email as verified """
        self.data['email_verified'] = True
        db.update_row( 't_user', 'email', self.id, { 'email_verified':True })

    def email_verified( self):
        return self.data.get( 'email_verified', False)

# flask_login needs this callback
@login_manager.user_loader
def load_user( email):
    #print('################# load user')
    user = User( email)
    if not user.valid:
        return None
    elif not user.email_verified():
        return None
    return user
