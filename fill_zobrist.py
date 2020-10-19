# /********************************************************************
# Filename: katago-gui/katago_gui/fill_zobrist.py
# Author: AHN
# Creation Date: Oct, 2020
# **********************************************************************/
#
# Fill zobrist column for all games older than 5 minutes.
#

from pdb import set_trace as BP

import os, sys, re, json
from katago_gui import db, dbmodel
from katago_gui import go_utils
from katago_gui import BOARD_SIZE, ZOBRIST_MOVES


#---------------------------
def usage(printmsg=False):
    name = os.path.basename(__file__)
    msg = '''

    Name:
      %s: Recomupte the zobrist hash for all games inactive for five minutes or more.
    Synopsis:
      %s --run
    Description:
      Recomupte the zobrist hash for all games inactive for five minutes or more.
      Zobrist has is the max across all 8 symmetries, and thus invariant.
    Examples:
      $ time %s --run
--
    ''' % (name,name,name)
    if printmsg:
        print(msg)
        exit(1)
    else:
        return msg

#------------
def main():
    if len(sys.argv) != 2:
        usage( True)

    n = 0
    total = db.select( 'select count(*) from v_games_no_zobrist')[0]['count']

    while(1):
        rows = db.select( 'select * from v_games_no_zobrist limit 10')
        if len(rows) == 0: break
        n += len(rows)
        print( 'Updating zobrist hashes %d/%d' % (n,total))
        for row in rows:
            try:
                game_hash = row['game_hash']
                game = dbmodel.Game( game_hash)
                if not game.data['game_record']:
                    print( 'No game record for game hash %s; ignoring' % game_hash)
                    continue
                rec = game.data['game_record']['record']
                if not rec:
                    print( 'No moves for game hash %s; erasing game' % game_hash)
                    db.update_row( 't_game', 'game_hash', game_hash, {'game_record':''})
                    continue
                if len( game.data['game_record']['var_record']) > len(rec):
                    rec = game.data['game_record']['var_record']
                moves = [x['mv'] for x in rec]
                rc0s = []
                # Convert to 0 based 0-18 (row,col) pairs
                for move in moves:
                    coord = move
                    if coord in ('pass','resign'):
                        rc0s.append( coord)
                        continue
                    point = go_utils.point_from_coords( coord)
                    rc0 = (point.row - 1, point.col - 1)
                    rc0s.append( rc0)
                zobrist = go_utils.game_zobrist( rc0s, ZOBRIST_MOVES)
                db.update_row( 't_game', 'game_hash', game_hash, {'zobrist':str(zobrist)})
                db.tstamp( 't_game',  'game_hash', game_hash, 'ts_zobrist')
                print( 'updated %s' % game_hash)
            except Exception as e:
                print( 'Exception updating zobrist for game hash %s; erasing game' % game_hash)
                db.update_row( 't_game', 'game_hash', game_hash, {'game_record':''})

    print( 'Done')


if __name__ == '__main__':
    main()
