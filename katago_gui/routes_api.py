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
from katago_gui.helpers import get_sgf_tag, moves2sgf, login_as_guest
from katago_gui.helpers import fwd_to_katago, fwd_to_katago_x, fwd_to_katago_guest, fwd_to_katago_9, fwd_to_katago_13

#--------------------------------------
# API endpoints in alphabetical order
#--------------------------------------

@app.route('/create_game', methods=['POST'])
#-----------------------------------------------
def create_game():
    """ Create a new game in the database """
    try:
        data = request.json
        data.update( {'username':current_user.data['username']})
        game = dbmodel.Game()

        # Store user IP with the game
        if request.headers.getlist("X-Forwarded-For"):
            ip = request.headers.getlist("X-Forwarded-For")[0]
        else:
            ip = request.remote_addr
        data.update( {'ip_addr':ip} )

        game.update_db( data)
        current_user.data['game_hash'] = game.id
        current_user.update_db()
        return jsonify( {'game_hash': game.id })
    except:
        app.logger.info( 'ERROR: Exception in create_game()')
        return redirect( url_for('index'))

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
    try:
        data = current_user.data
        return jsonify( data)
    except:
        app.logger.info( 'ERROR: Exception in get_user_data()')
        return redirect( url_for('index'))

@app.route('/english', methods=['GET'])
#-------------------------------------------
def english():
    """ Switch user language to English """
    try:
        current_user.data['lang'] = 'eng'
        current_user.update_db()
    except:
        app.logger.info( 'ERROR: Exception while switching to English')
    return redirect( url_for('index'))

@app.route('/korean', methods=['GET'])
#----------------------------------------
def korean():
    """ Switch user language to Korean """
    try:
        current_user.data['lang'] = 'kor'
        current_user.update_db()
    except:
        app.logger.info( 'ERROR: Exception while switching to Korean')
    return redirect( url_for('index'))

@app.route('/chinese', methods=['GET'])
#----------------------------------------
def chinese():
    """ Switch user language to Chinese """
    try:
        current_user.data['lang'] = 'chinese'
        current_user.update_db()
    except:
        app.logger.info( 'ERROR: Exception while switching to Chinese')
    return redirect( url_for('index'))

@app.route('/japanese', methods=['GET'])
#----------------------------------------
def japanese():
    """ Switch user language to Japanese """
    try:
        current_user.data['lang'] = 'japanese'
        current_user.update_db()
    except:
        app.logger.info( 'ERROR: Exception while switching to Japanese')
    return redirect( url_for('index'))

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
    try:
        db.update_row( 't_user', 'email', current_user.id, {'watch_game_hash':''})
        logout_user()
    except:
        app.logger.info( 'ERROR: Exception in logout()')
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
    res = fwd_to_katago_x( endpoint, args)
    return jsonify( res)

@app.route('/select-move/<bot_name>', methods=['POST'])
#---------------------------------------------------------
def select_move( bot_name):
    """ Forward select-move to the katago server """
    try:
        current_user.record_activity()
    except:
        pass

    endpoint = 'select-move/' + bot_name
    args = request.json

    try:
        if 'selfplay' in args:
            current_user.count_selfplay_move()
        else:
            current_user.count_move()
    except:
        pass

    res = fwd_to_katago( endpoint, args)
    try:
        return jsonify( res)
    except:
        print( 'select move error: %s' % res)
        return jsonify( {'result': 'error: forward failed' })

@app.route('/select-move-guest/<bot_name>', methods=['POST'])
#----------------------------------------------------------------
def select_move_guest( bot_name):
    """ Forward select-move to the katago server """
    try:
        current_user.record_activity()
    except:
        pass

    endpoint = 'select-move/' + bot_name
    args = request.json

    try:
        if 'selfplay' in args:
            current_user.count_selfplay_move()
        else:
            current_user.count_move()
    except:
        pass

    res = fwd_to_katago_guest( endpoint, args)
    try:
        return jsonify( res)
    except:
        print( 'select move guest error: %s' % res)
        return jsonify( {'result': 'error: forward failed' })

@app.route('/select-move-x/<bot_name>', methods=['POST'])
#-----------------------------------------------------------
def select_move_x( bot_name):
    """ Forward select-move to the katago server """
    try:
        current_user.record_activity()
    except:
        pass

    endpoint = 'select-move/' + bot_name
    args = request.json

    try:
        if 'selfplay' in args:
            current_user.count_selfplay_move()
        else:
            current_user.count_move()
    except:
        pass

    res = fwd_to_katago_x( endpoint, args)
    try:
        return jsonify( res)
    except:
        print( 'select move x error: %s' % res)
        return jsonify( {'result': 'error: forward failed' })

@app.route('/select-move-9/<bot_name>', methods=['POST'])
#-----------------------------------------------------------
def select_move_9( bot_name):
    """ Forward select-move to the katago server """
    try:
        current_user.record_activity()
    except:
        pass

    endpoint = 'select-move/' + bot_name
    args = request.json

    try:
        if 'selfplay' in args:
            current_user.count_selfplay_move()
        else:
            current_user.count_move()
    except:
        pass

    res = fwd_to_katago_9( endpoint, args)
    try:
        return jsonify( res)
    except:
        print( 'select move 9 error: %s' % res)
        return jsonify( {'result': 'error: forward failed' })

@app.route('/select-move-13/<bot_name>', methods=['POST'])
#-----------------------------------------------------------
def select_move_13( bot_name):
    """ Forward select-move to the katago server """
    try:
        current_user.record_activity()
    except:
        pass

    endpoint = 'select-move/' + bot_name
    args = request.json

    try:
        if 'selfplay' in args:
            current_user.count_selfplay_move()
        else:
            current_user.count_move()
    except:
        pass

    res = fwd_to_katago_13( endpoint, args)
    try:
        return jsonify( res)
    except:
        print( 'select move 13 error: %s' % res)
        return jsonify( {'result': 'error: forward failed' })

@app.route('/server_ip', methods=['GET'])
#---------------------------------------------
def server_ip():
    """
    Get the caller IP (the katago server) and store it in the DB.
    A service on the katago server (marfa) hits this every minute.
    No more need for dyndns and noip and apache on the katago server.
    The IP is used in the fwd_to_katago_* endpoints called from heroku.
    """
    try:
        if request.args.get('pwd') != '3515862':
            return jsonify( {'result': 'ERROR' })
        if request.headers.getlist("X-Forwarded-For"):
            ip = request.headers.getlist("X-Forwarded-For")[0]
        else:
            ip = request.remote_addr
        db.set_parm( 'server_ip', ip)
        db.set_parm( 'server_ip_updated', str(datetime.now()))
        return jsonify( {'result': 'ok' })
    except:
        return jsonify( {'result': 'EXCEPTION' })

@app.route('/sgf2list', methods=['POST'])
#-------------------------------------------
def sgf2list():
    """ Convert sgf main var to coordinate list of moves """
    f = request.files['file']
    sgfstr = f.read().decode('utf-8')
    sgfstr = re.sub( 'CoPyright', 'CP', sgfstr) # IGS anomaly
    RE = get_sgf_tag( sgfstr, 'RE')
    if len(RE) > 10: RE = ''
    DT = get_sgf_tag( sgfstr, 'DT')
    if len(DT) > 15: DT = ''
    sgf = Sgf_game.from_string( sgfstr)
    player_white = sgf.get_player_name('w')
    player_black = sgf.get_player_name('b')
    winner = sgf.get_winner()
    komi = sgf.get_komi()
    if komi == 375: komi = 7.5 # fox server anomaly
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
    try:
        data = request.json
        game_hash = current_user.data['game_hash']
        if not game_hash:
            msg = 'error: user %s is not in a game.' % current_user.data['username']
            app.logger.info( '>>>> ' + msg)
            return jsonify( {'result': msg})
        game = dbmodel.Game( game_hash)
        game.update_db( data)

        # Tell all the watchers about the change.
        # This will wake up the other dynos and hit their WatcherSockets.send() in routes_watch.py
        nmoves = 0
        try:
            gr = game.data['game_record']
            nmoves = gr['n_visible']
            # Get a flask response and extract the json.
            # This deals with dates, which json.dumps does not.
            jsonstr = jsonify( {'action':'update_game',
                                'game_hash':game_hash,
                                'game_data':game.data,
                                'nmoves':nmoves,
                                'client_timestamp':data.get( 'client_timestamp', 0) }).data
            redis.publish( REDIS_CHAN, jsonstr)
        except:
            app.logger.info( 'EXCEPTION in update_game(), ignored')

        color = 'B' if nmoves % 2 else 'W'
        app.logger.info( '>>>>>>>>>>>>>>>>> update game %s %s %d' % (str(game_hash), color, nmoves))
        return jsonify( {'result': 'ok' })
    except:
        app.logger.info( 'ERROR: Exception in update_game()')
        return jsonify( {'result': 'error: update_game() failed' })


@app.route('/chat', methods=['POST'])
#----------------------------------------------
def chat():
    """ Send a chat message to all other observers """
    try:
        game_hash = request.json['game_hash']
        msg = request.json['msg']
        username = current_user.data['username']
        d = {'action':'chat', 'game_hash':game_hash, 'msg':msg, 'username':username}
        redis.publish( REDIS_CHAN, json.dumps( d))
        return jsonify( {'result': 'ok' })
    except:
        app.logger.info( 'ERROR: Exception in chat()')
        return jsonify( {'result': 'error: chat() failed' })
