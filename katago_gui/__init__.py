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

from katago_gui import routes
