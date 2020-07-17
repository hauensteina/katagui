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
from katago_gui.postgres import Postgres
from katago_gui.create_tables import create_tables

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

# 20b 512 playouts
KATAGO_SERVER = 'http://www.ahaux.com/katago_server/'
# 40b 1024 playouts
KATAGO_SERVER_X = 'http://www.ahaux.com/katago_server_x/'

if 'HEROKU_FLAG' in os.environ: # prod on heroku
    db_url = os.environ['DATABASE_URL']
else: # local
    db_url = os.environ['KATAGO_DB_URL']

db = Postgres( db_url)
create_tables( db)

bcrypt = Bcrypt( app) # Our password hasher
login_manager = LoginManager( app)
login_manager.login_view = 'login' # The route if you should be logged in but aren't
login_manager.login_message_category = 'info' # Flash category for 'Please log in' message

from katago_gui import routes
