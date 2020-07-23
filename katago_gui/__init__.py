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
from flask_login import LoginManager
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
else: # local
    db_url = os.environ['KATAGUI_DB_URL']

db = Postgres( db_url)

bcrypt = Bcrypt( app) # Our password hasher
login_manager = LoginManager( app)
login_manager.login_view = 'login' # The route if you should be logged in but aren't
login_manager.login_message_category = 'info' # Flash category for 'Please log in' message

app.config['MAIL_SERVER'] = 'smtp.googlemail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('KATAGUI_EMAIL_USER')
app.config['MAIL_PASSWORD'] = os.environ.get('KATAGUI_EMAIL_PASS') + '01!'
mail = Mail(app)

from katago_gui.create_tables import create_tables
create_tables( db)
from katago_gui import routes
