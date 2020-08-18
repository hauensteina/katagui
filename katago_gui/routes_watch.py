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
from datetime import datetime

from flask import jsonify, request, send_file, render_template, flash, redirect, url_for

from katago_gui import app, logged_in
from katago_gui import auth, db
from katago_gui.translations import translate as tr

@app.route('/watch_select_game')
#---------------------------------
def watch_select_game():
    sql = """
    select
      u.username, u.game_hash, now() - g.ts_latest_move as t_idle
      from t_user u, t_game g
      where u.game_hash = g.game_hash
      order by t_idle
    """
    rows = db.select( sql)
    games = []
    for row in rows:
        g = {}
        g['user'] = row['username']
        g['age'] = row['t_idle']
        g['link'] = url_for( 'watch_game',game_hash=row['game_hash'])
        games.append( g)
    return render_template( 'watch_select_game.tmpl', games=games)

@app.route('/watch_game')
#----------------------------
def watch_game():
    gh = request.args['game_hash']
    return render_template( 'watch.tmpl', game_hash=gh)
