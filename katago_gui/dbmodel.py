# /********************************************************************
# Filename: katago_gui/dbmodel.py
# Author: AHN
# Creation Date: Aug, 2020
# **********************************************************************/
#
# Wrapper classes for the DB tables
#

import uuid
from katago_gui import db
from pdb import set_trace as BP

class Game:
    """ A game record as defined in create_tables.py """
    def __init__( self, game_hash=None):
        self.valid = True
        self.data = {}
        self.id = game_hash if game_hash else uuid.uuid4().hex[:16]
        rows = db.find( 't_game', 'game_hash', self.id)
        if not rows:
            self.valid = False
            return
        self.data = rows[0]

    def update_db( self, data):
        """ Create or update game in DB """
        self.data = data
        self.data['game_hash'] = self.id
        rows = db.find( 't_game', 'game_hash',  self.id)
        if not rows:
            db.insert( 't_game', (data,))
            db.tstamp( 't_game', 'game_hash', self.id, 'ts_started')
            self.valid = True
            return
        db.update_row( 't_game', 'game_hash', self.id, data)
        db.tstamp( 't_game', 'game_hash', self.id, 'ts_latest_move')
        self.valid = True
        return

    def read_db( self):
        """ Read our data from the db """
        data = db.find( 't_game', 'game_hash', self.id)[0]
        self.data.update( data)
