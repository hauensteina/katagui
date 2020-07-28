# /********************************************************************
# Filename: katago-gui/katago_gui/__init__.py
# Author: AHN
# Creation Date: Jul, 2020
# **********************************************************************/
#
# Imports and Globals
#

import os
from flask import Flask
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, user_logged_out, user_logged_in
from flask_mail import Mail
from katago_gui.postgres import Postgres

from pdb import set_trace as BP

here = os.path.dirname( __file__)
static_path = os.path.join( here, 'static')
app = Flask( __name__, static_folder=static_path, static_url_path='/static')

app.config.update(
    DEBUG = True,
    SECRET_KEY = 'secret_xxx'
)

# This gives you decent error messages in the browser
app.config['DEBUG'] = os.getenv("DEBUG", False)
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024

# 20b 256 playouts
KATAGO_SERVER = 'http://www.ahaux.com/katago_server/'
# 40b 1024 playouts
KATAGO_SERVER_X = 'http://www.ahaux.com/katago_server_x/'
# 10b 256 playouts
KATAGO_SERVER_GUEST = 'http://www.ahaux.com/katago_server_guest/'

if 'HEROKU_FLAG' in os.environ: # prod on heroku
    db_url = os.environ['DATABASE_URL']
    #mailgun_api_key = os.environ['MAILGUN_API_KEY']
else: # local
    db_url = os.environ['KATAGUI_DB_URL']
    #mailgun_api_key = os.environ['KATAGUI_MAILGUN_API_KEY']

db = Postgres( db_url)

bcrypt = Bcrypt( app) # Our password hasher
login_manager = LoginManager( app)
login_manager.login_view = 'login' # The route if you should be logged in but aren't
login_manager.login_message_category = 'info' # Flash category for 'Please log in' message

app.config['MAIL_SERVER'] = 'mail.hover.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = False
app.config['MAIL_USERNAME'] = os.environ.get('KATAGUI_EMAIL_USER')
app.config['MAIL_PASSWORD'] = os.environ.get('KATAGUI_EMAIL_PASS')
mail = Mail(app)

from katago_gui.create_tables import create_tables
create_tables( db)

# Make sure the DB knows if we are logged in or out
# def logout_db( sender, user, **extra):
#     db.update_row( 't_user', 'email', user.data['email'], { 'logged_in':False, 'active':False })
# user_logged_out.connect( logout_db, app)

# def login_db( sender, user, **extra):
#     db.update_row( 't_user', 'email', user.data['email'], { 'logged_in':True, 'active':True })
# user_logged_in.connect( login_db, app)

from katago_gui import routes
