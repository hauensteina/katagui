#!/usr/bin/env python

# /********************************************************************
# Filename: katago-gui/katago_gui/heroku_app.py
# Author: AHN
# Creation Date: Jul, 2020
# **********************************************************************/
#
# A web front end for REST Api katago-server
#

from pdb import set_trace as BP
from katago_gui import app

#----------------------------
if __name__ == '__main__':
    # This won't work with websockets.
    app.run( host='0.0.0.0', port=8000, debug=True)
    # Instead when debugging:
    # $ source .env; gunicorn -k flask_sockets.worker heroku_app:app -w 1 -b 0.0.0.0:8000 --reload --timeout 1000
