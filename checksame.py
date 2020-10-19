#!/usr/bin/env python

# /********************************************************************
# Filename: katago-gui/katago_gui/checksame.py
# Author: AHN
# Creation Date: Oct, 2020
# **********************************************************************/
#
# A script to check whether the first ZOBRIST_MOVES moves of to sgf files are the same,
# taking care of all symmetries, using zobrist hashing.

#
from pdb import set_trace as BP

import os, sys, re
from datetime import datetime
#import argparse
from katago_gui.sgf import Sgf_game
import katago_gui.goboard_fast as goboard
from katago_gui.go_utils import point_from_coords, game_zobrist, board_transform
from katago_gui.gotypes import Player,Point
from katago_gui.zobrist import HASH_CODE, EMPTY_BOARD
from katago_gui.helpers import moves2sgf

from katago_gui import BOARD_SIZE, ZOBRIST_MOVES

#---------------------------
def usage(printmsg=False):
    name = os.path.basename(__file__)
    msg = '''

    Name:
      %s: Check if two sgf files agree on the first %d moves, after eliminating symmetries.
    Synopsis:
      %s <transform> <file1.sgf> <file2.sgf>
    Description:
      Transform file1.sgf with one of ['0','lr','td','ri','le','letd','ritd','lrtd']
      and save to checksame1.sgf. Then check if it is the same as file2.sgf .
    Examples:
      %s lr first.sgf second.sgf
      %s td first.sgf first.sgf
--
    ''' % (name,ZOBRIST_MOVES,name,name,name)
    if printmsg:
        print(msg)
        exit(1)
    else:
        return msg

#------------
def main():
    if len(sys.argv) != 4:
        usage( True)

    transform = sys.argv[1]
    sgfname1 = sys.argv[2]
    sgfname2 = sys.argv[3]
    with open(sgfname1) as x: sgfstr1 = x.read()
    with open(sgfname2) as x: sgfstr2 = x.read()
    moves1 = getmoves( sgfstr1)
    moves2 = getmoves( sgfstr2)
    moves1 = rotmoves( moves1, transform)
    rotsgf = moves2sgf( moves1)
    with open( 'checksame1.sgf', 'w') as x: x.write( rotsgf)

    zob1 = game_zobrist( moves1)
    zob2 = game_zobrist( moves2)
    if zob1 == zob2:
        print( 'same')
    else:
        print( 'different')

# #------------------------------------------------------
# def zobrist( moves, zobrist_moves = ZOBRIST_MOVES):
#     zobrist = 0
#     for transform_key in ['0','lr','td','ri','le','letd','ritd','lrtd']:
#         game_state = goboard.GameState.new_game( BOARD_SIZE)
#         for idx,move in enumerate(moves):
#             if move == 'pass':
#                 next_move = goboard.Move.pass_turn()
#             elif move == 'resign':
#                 next_move = goboard.Move.resign()
#             else:
#                 move = transform( move, transform_key)
#                 next_move = goboard.Move.play( Point( move[0]+1, move[1]+1))
#             game_state = game_state.apply_move( next_move)
#         zobrist = max( game_state.board.zobrist_hash(), zobrist)
#     return zobrist

#--------------------------------------
def rotmoves( moves, transform_key):
    res = []
    for idx,move in enumerate( moves):
        res.append( board_transform( move, transform_key))
    return res

#--------------------------------------------------------------------------
def getmoves( sgfstr):
    'Turn an sgf string into a list of moves like [(3,3), "pass",  ...]'
    sgf = Sgf_game.from_string( sgfstr)
    moves = []
    for idx,item in enumerate(sgf.main_sequence_iter()):
        color, move = item.get_move()
        if not color: continue
        if not move:
            moves.append( 'pass')
        else:
            moves.append( move)
    return moves


'Convert a list of moves like [(2,3), ...] to sgf'
#---------------------------------------------------
def moves2sgf( moves):
    'Convert a list of moves like [(2,3), ...] to sgf'
    sgf = '(;FF[4]SZ[19]\n'
    sgf += 'SO[checksame.py]\n'
    dtstr = datetime.now().strftime('%Y-%m-%d')
    km = '7.5'

    sgf += 'PB[black]\n'
    sgf += 'PW[white]\n'
    sgf += 'KM[%s]\n' % km
    sgf += 'DT[%s]\n' % dtstr

    movestr = ''
    result = ''
    color = 'B'
    for idx,move in enumerate(moves):
        othercol = 'W' if color == 'B' else 'B'
        if move == 'resign':
            result = 'RE[%s+R]' % othercol
        elif move == 'pass':
            movestr += ';%s[tt]' % color
        else:
            col_s = 'abcdefghijklmnopqrstuvwxy'[move[1]]
            row_s = 'abcdefghijklmnopqrstuvwxy'[18 - move[0]]
            movestr += ';%s[%s%s]' % (color,col_s,row_s)
        color = othercol

    sgf += result
    sgf += movestr
    sgf += ')'
    return sgf

if __name__ == '__main__':
    main()
