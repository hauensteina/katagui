# /********************************************************************
# Filename: katago_gui/routes_api.py
# Author: AHN
# Creation Date: Jul, 2020
# **********************************************************************/
#
# API Endpoints
#
from pdb import set_trace as BP

import os, sys, re, json
import requests
from datetime import datetime
import uuid
from io import BytesIO

from flask import jsonify, request, send_file, redirect, url_for
from flask_login import current_user, logout_user

from katago_gui.gotypes import Point
from katago_gui.sgf import Sgf_game
from katago_gui.go_utils import coords_from_point

from katago_gui import app, db, redis, REDIS_CHAN
from katago_gui import dbmodel
import katago_gui.translations
from katago_gui.helpers import get_sgf_tag, fwd_to_katago, fwd_to_katago_x, fwd_to_katago_guest, moves2sgf, login_as_guest

#--------------------------------------
# API endpoints in alphabetical order
#--------------------------------------

@app.route('/create_game', methods=['POST'])
#-----------------------------------------------
def create_game():
    """ Create a new game in the database """
    data = request.json
    data.update( {'owner_email':current_user.data['email']})
    game = dbmodel.Game()
    game.update_db( data)
    current_user.data['game_hash'] = game.id
    current_user.update_db()
    return jsonify( {'game_hash': game.id })

@app.route('/english', methods=['GET'])
#-------------------------------------------
def english():
    """ Switch user language to English """
    current_user.data['lang'] = 'eng'
    current_user.update_db()
    return redirect(url_for('index'))

@app.route('/get_translation_table', methods=['POST'])
#---------------------------------------------------------
def get_translation_table():
    """ Get internationalization lookup dictionary """
    tab = katago_gui.translations.get_translation_table()
    return jsonify( tab)

@app.route('/get_user_data', methods=['POST'])
#------------------------------------------------
def get_user_data():
    """ Get current user data """
    data = current_user.data
    return jsonify( data)

@app.route('/korean', methods=['GET'])
#----------------------------------------
def korean():
    """ Switch user language to Korean """
    current_user.data['lang'] = 'kor'
    current_user.update_db()
    return redirect(url_for('index'))

@app.route('/load_game', methods=['POST'])
#----------------------------------------------
def load_game():
    """ Load a game from the database """
    game_hash = request.json['game_hash']
    game = dbmodel.Game( game_hash)
    res = jsonify( game.data)
    return res

@app.route('/logout')
#-------------------------
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/save-sgf', methods=['GET'])
#-------------------------------------------
def save_sgf():
    """
    Convert moves to sgf and return as file attachment.
    Moves come like 'Q16D4...' to shorten URL.
    """
    pb = request.args.get( 'pb')
    pw = request.args.get( 'pw')
    km = request.args.get( 'km')
    re = request.args.get( 're')
    dt = request.args.get( 'dt')
    meta = { 'pb':pb, 'pw':pw, 'km':km, 're':re, 'dt':dt }

    probs = request.args.get( 'probs', [])
    probs = probs.split(',')
    scores = request.args.get( 'scores', [])
    scores = scores.split(',')
    moves = request.args.get( 'moves')
    movearr = []
    m = ''
    for c in moves:
        if c > '9': # a letter
            if m: movearr.append(m)
            m = c
        else:
            m += c
    if m: movearr.append(m)
    result = moves2sgf( movearr, probs, scores, meta)
    fname = uuid.uuid4().hex[:7] + '.sgf'
    fh = BytesIO( result.encode('utf8'))
    resp = send_file( fh, as_attachment=True, attachment_filename=fname)
    return resp

@app.route('/score/<bot_name>', methods=['POST'])
#---------------------------------------------------
def score( bot_name):
    """ Forward score to the katago server """
    endpoint = 'score/' + bot_name
    args = request.json
    res = fwd_to_katago( endpoint, args)
    return jsonify( res)

@app.route('/select-move/<bot_name>', methods=['POST'])
#---------------------------------------------------------
def select_move( bot_name):
    """ Forward select-move to the katago server """
    current_user.record_activity()
    endpoint = 'select-move/' + bot_name
    args = request.json

    if 'selfplay' in args:
        current_user.count_selfplay_move()
    else:
        current_user.count_move()

    res = fwd_to_katago( endpoint, args)
    try:
        return jsonify( res)
    except:
        print( 'select move error: %s' % res)

@app.route('/select-move-guest/<bot_name>', methods=['POST'])
#----------------------------------------------------------------
def select_move_guest( bot_name):
    """ Forward select-move to the katago server """
    current_user.record_activity()
    endpoint = 'select-move/' + bot_name
    args = request.json

    if 'selfplay' in args:
        current_user.count_selfplay_move()
    else:
        current_user.count_move()

    res = fwd_to_katago_guest( endpoint, args)
    try:
        return jsonify( res)
    except:
        print( 'select move guest error: %s' % res)

@app.route('/select-move-x/<bot_name>', methods=['POST'])
#-----------------------------------------------------------
def select_move_x( bot_name):
    """ Forward select-move to the katago server """
    current_user.record_activity()
    endpoint = 'select-move/' + bot_name
    args = request.json

    if 'selfplay' in args:
        current_user.count_selfplay_move()
    else:
        current_user.count_move()

    res = fwd_to_katago_x( endpoint, args)
    try:
        return jsonify( res)
    except:
        print( 'select move x error: %s' % res)

@app.route('/sgf2list', methods=['POST'])
#-------------------------------------------
def sgf2list():
    """ Convert sgf main var to coordinate list of moves """
    f = request.files['file']
    sgfstr = f.read()
    RE = get_sgf_tag( sgfstr, 'RE')
    if len(RE) > 10: RE = ''
    DT = get_sgf_tag( sgfstr, 'DT')
    sgf = Sgf_game.from_string( sgfstr)
    player_white = sgf.get_player_name('w')
    player_black = sgf.get_player_name('b')
    winner = sgf.get_winner()
    komi = sgf.get_komi()
    fname = f.filename

    res = {}
    moves = []

    #------------------------
    def move2coords( move):
        row, col = move
        p = Point( row + 1, col + 1)
        coords = coords_from_point( p)
        return coords

    # Deal with handicap in the root node
    handicap_setup_done = False
    if sgf.get_handicap() is not None and sgf.get_handicap() != 0:
        for setup in sgf.get_root().get_setup_stones():
            for idx, move in enumerate( setup):
                handicap_setup_done = True
                if idx > 0: moves.append( {'mv':'pass', 'p':'0.00', 'score':'0.0' } )
                moves.append( {'mv':move2coords( move), 'p':'0.00', 'score':'0.0' })

    # Nodes in the main sequence
    for item in sgf.main_sequence_iter():
        color, move_tuple = item.get_move()
        point = None
        if color is not None:
            if move_tuple is not None:
                p = '0.00'
                score = '0.0'
                props = item.get_raw_property_map()
                props = { key.decode(): props[key] for key in props.keys() }
                if 'C' in props:
                    com = props['C'][0].decode()
                    if com.startswith('P:'):
                        parts = com.split(' ')
                        left = parts[0]
                        p = left.split(':')[1]
                        if len(parts) > 1 and 'S:' in com:
                            right = parts[1]
                            score = right.split(':')[1]
                turn = 'w' if len(moves) % 2 else 'b'
                if color != turn: moves.append( {'mv':'pass', 'p':'0.00', 'score':'0.0'})
                moves.append( {'mv':move2coords( move_tuple), 'p':p, 'score':score })
            else:
                moves.append( {'mv':'pass', 'p':'0.00', 'score':'0.0'})
        # Deal with handicap stones as individual nodes
        elif item.get_setup_stones()[0] and not handicap_setup_done:
            move = list( item.get_setup_stones()[0])[0]
            if moves: moves.append( {'mv':'pass', 'p':'0.00', 'score':'0.0'})
            moves.append( {'mv':move2coords( move), 'p':'0.00', 'score':'0.0' })

    probs = [mp['p'] for mp in moves]
    scores = [mp['score'] for mp in moves]
    moves = [mp['mv'] for mp in moves]
    return jsonify( {'result': {'moves':moves, 'probs':probs, 'scores':scores, 'pb':player_black, 'pw':player_white,
                                'winner':winner, 'komi':komi, 'fname':fname, 'RE':RE, 'DT':DT} } )

@app.route('/slog', methods=['POST'])
#---------------------------------------
def slog():
    """ Write to the server log """
    msg = request.json.get( 'msg', 'empty_msg')
    print( 'slog: %s' % msg)
    return jsonify( {'result': 'ok' })

@app.route('/update_game', methods=['POST'])
#----------------------------------------------
def update_game():
    """ Update a game in the database """
    data = request.json
    game_hash = current_user.data['game_hash']
    game = dbmodel.Game( game_hash)
    game.update_db( data)

    # Tell all the watchers about the change.
    # This will wake up the other dynos and hit their WatcherSockets.send() in routes_watch.py
    redis.publish( REDIS_CHAN, json.dumps( {'action':'update_game', 'game_hash':game_hash}))

    return jsonify( {'result': 'ok' })

@app.route('/chat', methods=['POST'])
#----------------------------------------------
def chat():
    """ Send a chat message to all other observers """
    game_hash = request.json['game_hash']
    msg = request.json['msg']
    username = current_user.data['username']
    d = {'action':'chat', 'game_hash':game_hash, 'msg':msg, 'username':username}
    redis.publish( REDIS_CHAN, json.dumps( d))
    return jsonify( {'result': 'ok' })
