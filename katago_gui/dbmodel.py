# /********************************************************************
# Filename: katago_gui/dbmodel.py
# Author: AHN
# Creation Date: Aug, 2020
# **********************************************************************/
#
# Wrapper classes for the DB tables
#

import json
import uuid
from katago_gui import db, app
from pdb import set_trace as BP

class Game:
    """ A game record as defined in create_tables.py """
    def __init__( self, game_hash=None):
        self.valid = True
        self.data = {}
        #if not game_hash: app.logger.info('>>>>>>>>>> Game without game_hash')
        self.id = game_hash if game_hash else uuid.uuid4().hex[:16]
        rows = db.find( 't_game', 'game_hash', self.id)
        if not rows:
            self.valid = False
            return
        self.data = rows[0]
        if self.data['game_record']: # Convert json string to a python object
            self.data['game_record'] = json.loads( self.data['game_record'])

    def update_db( self, data):
        """ Create or update game in DB """
        self.data.update( data)
        self.data['game_hash'] = self.id
        rows = db.find( 't_game', 'game_hash',  self.id)
        if not rows:
            db.insert( 't_game', (self.data,))
            db.tstamp( 't_game', 'game_hash', self.id, 'ts_started')
            self.valid = True
            return 'inserted'
        db.update_row( 't_game', 'game_hash', self.id, self.data)
        db.tstamp( 't_game', 'game_hash', self.id, 'ts_latest_move')
        if self.data['game_record']: # Convert json string to a python object
            self.data['game_record'] = json.loads( self.data['game_record'])
        self.valid = True
        return 'updated'

    def read_db( self):
        """ Read our data from the db """
        data = db.find( 't_game', 'game_hash', self.id)[0]
        self.data.update( data)
