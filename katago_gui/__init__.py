# /********************************************************************
# Filename: katago-gui/katago_gui/__init__.py
# Author: AHN
# Creation Date: Jul, 2020
# **********************************************************************/
#
# Imports and Globals
#

from pdb import set_trace as BP

import os,random
import logging
import redis
import gevent
from urllib.parse import urlparse

from flask import Flask
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, user_logged_out, user_logged_in, current_user
from flask_mail import Mail
from flask_sockets import Sockets
from katago_gui.postgres import Postgres
from katago_gui.translations import translate, donation_blurb

ZOBRIST_MOVES = 40
BOARD_SIZE = 19

app = Flask( __name__)
sockets = Sockets(app)

#----------------
def logged_in():
    return current_user.is_authenticated and not current_user.data['username'].startswith('guest_')

#-------------
def rrand():
    return str(random.uniform(0,1))

# Make some functions available in the jinja templates.
# Black Magic.
@app.context_processor
def inject_template_funcs():
    return {'tr':translate # {{ tr('Play') }} now puts the result of translate('Play') into the template
            ,'donation_blurb':donation_blurb
            ,'logged_in':logged_in
            ,'rrand':rrand
            }

app.config.update(
    DEBUG = True,
    SECRET_KEY = 'secret_xxx'
)

app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024

DEMO_KATAGO_SERVER = 'https://my-katago-server.herokuapp.com'
# 20b 256 playouts
#KATAGO_SERVER = 'http://www.ahaux.com/katago_server/'
# 40b 1024 playouts
#KATAGO_SERVER_X = 'http://www.ahaux.com/katago_server_x/'
# 10b 256 playouts
#KATAGO_SERVER_GUEST = 'http://www.ahaux.com/katago_server_guest/'

db_url = os.environ['DATABASE_URL']
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

if os.environ.get('FLASK_ENV') == 'dev':
    REDIS_URL='redis://localhost:6379'
    redis = redis.from_url(REDIS_URL) # when running locally    
else:    
    # Redis and websockets for server push needed to watch games
    REDIS_URL = os.environ['REDIS_URL']
    url = urlparse(REDIS_URL)
    redis = redis.Redis( host=url.hostname, port=url.port, username=url.username, password=url.password, ssl=True, ssl_cert_reqs=None)

REDIS_CHAN = 'watch'

from katago_gui.create_tables import create_tables
create_tables( db)

from katago_gui import routes
from katago_gui import routes_watch
from katago_gui import routes_api

