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
import gevent

from flask import jsonify, request, send_file, render_template, flash, redirect, url_for
from flask_login import current_user

from katago_gui import app, logged_in
from katago_gui import auth, db, sockets, redis, REDIS_CHAN
from katago_gui.translations import translate as tr


@app.route('/watch_select_game')
#---------------------------------
def watch_select_game():
    """ Show the screen to choose the game to watch """
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
    """ User clicks on the game he wants to watch """
    gh = request.args['game_hash']
    # Remember which game we are watching
    db.update_row( 't_user', 'email', current_user.id, {'watch_game_hash':gh})

    return render_template( 'watch.tmpl', game_hash=gh)

@sockets.route('/register_socket/<game_hash>')
#-----------------------------------------------
def register_socket( ws, game_hash):
    """ Client js registers to receive live pushes when game progresses """
    app.logger.info( '>>>>>>>>>>>>>>>>> register_socket ' + game_hash)
    watchers.register( ws, game_hash)

    while not ws.closed:
        # Context switch while `WatcherSockets.start` is running in the background.
        gevent.sleep(0.1)

#=======================
class WatcherSockets:
    """ Class to keep track of all game watchers and their websockets. """
    """ Black Magic involving Redis, Websockets, Python. """

    #----------------------
    def __init__( self):
        self.sockets_by_hash = {}
        self.pubsub = redis.pubsub()
        self.pubsub.subscribe( REDIS_CHAN)

    #------------------------
    def __iter_data( self):
        for message in self.pubsub.listen():
            data = message.get('data')
            if message['type'] == 'message':
                app.logger.info('Sending message: {}'.format(data))
                yield data

    #--------------------------------------------
    def register( self, websocket, game_hash):
        """ Register a WebSocket connection for Redis updates. """
        if not game_hash in self.sockets_by_hash:
            self.sockets_by_hash[game_hash] = []
            print('new game hash ' + game_hash)
        self.sockets_by_hash[game_hash].append( websocket)
        print( str(self.sockets_by_hash))

    #----------------------------------
    def send( self, websocket, data):
        """ Send given data to the registered clients. Automatically discards invalid connections. """
        try:
            websocket.send( data)
            print( 'sent to %s' % str(websocket))
        except Exception: # remove dead sockets
            print( 'send failed to %s' % str(websocket))
            for game_hash in self.sockets_by_hash:
                for ws in self.sockets_by_hash[game_hash]:
                    if ws is websocket:
                        self.sockets_by_hash[game_hash].remove( ws)

    #-----------------
    def run( self):
        """ Listens for new messages in Redis, and sends them to clients. """
        for data in self.__iter_data():
            msg = data.decode('utf-8')
            game_hash = json.loads( data)['game_hash']
            # Send to all who are watching this game
            if not game_hash in self.sockets_by_hash:
                app.logger.info( '>>>>>>>>>>>>>>>>> no observers for game ' + game_hash)
            else:
                app.logger.info( '>>>>>>>>>>>>>>>>> sending to observers for game ' + game_hash)
                for ws in self.sockets_by_hash[game_hash]:
                    gevent.spawn( self.send, ws, data.decode('utf-8'))

    #--------------------
    def start( self):
        """ Maintains Redis subscription in the background. """
        gevent.spawn(self.run)

watchers = WatcherSockets()
watchers.start()
