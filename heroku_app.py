#!/usr/bin/env python

# /********************************************************************
# Filename: katago-gui/katago_gui/heroku_app.py
# Author: AHN
# Creation Date: Jul, 2020
# **********************************************************************/
#
# A web front end for REST Api katago-server
#

from katago_gui import app

#----------------------------
if __name__ == '__main__':
    app.run( host='0.0.0.0', port=8000, debug=True)
