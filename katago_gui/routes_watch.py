# /********************************************************************
# Filename: katago-gui/katago_gui/routes_watch.py
# Author: AHN
# Creation Date: Aug, 2020
# **********************************************************************/
#
# URL Endpoints for observing games
#

from pdb import set_trace as BP

import os, sys, re, json
import requests
from datetime import datetime
import uuid
from io import BytesIO

from flask import jsonify, request, send_file, render_template, flash, redirect, url_for
from flask_login import login_user, current_user, logout_user, login_required
from flask_mail import Message
from itsdangerous import TimedJSONWebSignatureSerializer as Serializer

from katago_gui.gotypes import Point
from katago_gui.sgf import Sgf_game
from katago_gui.go_utils import coords_from_point

from katago_gui import app, bcrypt, mail, logged_in
from katago_gui import auth
import katago_gui.translations
from katago_gui.translations import translate as tr
from katago_gui.forms import LoginForm, RegistrationForm, RequestResetForm, ResetPasswordForm, UpdateAccountForm
from katago_gui.helpers import get_sgf_tag, fwd_to_katago, fwd_to_katago_x, fwd_to_katago_guest, moves2sgf

@app.route('/watch')
#-------------------------------
def index():
    if not check_https(): return redirect( 'https://katagui.herokuapp.com/watch')
    if not current_user.is_authenticated: login_as_guest()
    return render_template( 'watch.tmpl', mobile=False)

@app.route('/watch_mobile')
#-------------------------------
def index_mobile():
    if not check_https(): return redirect( 'https://katagui.herokuapp.com/watch_mobile')
    if not current_user.is_authenticated: login_as_guest()
    return render_template( 'watch_mobile.tmpl', mobile=True)

#-------------------------
def check_https():
    protocol = request.headers.get('X-Forwarded-Proto', 'http')
    if protocol != 'https' and 'HEROKU_FLAG' in os.environ:
        return False
    return True
