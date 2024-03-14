#!/usr/bin/env python

# /********************************************************************
# Filename: go_utils.py
# Author: AHN
# Creation Date: Mar, 2019
# **********************************************************************/
#
# Various Go utility funcs
#

from pdb import set_trace as BP
import katago_gui.gotypes as gotypes
import katago_gui.goboard_fast as goboard

COLS = 'ABCDEFGHJKLMNOPQRST'
STONE_TO_CHAR = {
    None: ' . ',
    gotypes.Player.black: ' x ',
    gotypes.Player.white: ' o '
}
BOARD_SIZE = 19

#-------------------------------
def print_move( player, move):
    if move.is_pass:
        move_str = 'passes'
    elif move.is_resign:
        move_str = 'resigns'
    else:
        move_str = '%s%d' % (COLS[move.point.col - 1], move.point.row)
    print( '%s %s' % (player, move_str))

#-------------------------
def print_board( board):
    for row in range( board.num_rows, 0, -1):
        bump = ' ' if row <= 9 else ''
        line = []
        for col in range( 1, board.num_cols + 1):
            stone = board.get( gotypes.Point( row, col))
            line.append( STONE_TO_CHAR[stone])
        print( '%s%d %s' % (bump, row, ''.join(line)))
    print('    ' + '  '.join( COLS[:board.num_cols]))

# Convert from sgf coords to Point
#-----------------------------------
def point_from_coords(coords):
        col = COLS.index(coords[0]) + 1
        row = int(coords[1:])
        return gotypes.Point(row=row, col=col)

# Convert from Point to sgf coords
#----------------------------------
def coords_from_point(point):
    return '%s%d' % (
        COLS[point.col - 1],
        point.row
    )

#-------------------------------------------
def board_transform( move, transform_key):
    'Rotate or mirrir a 0 based (r,c) pair'
    if not transform_key: return move
    if transform_key == '0': return move
    if move == 'pass': return move
    if len( transform_key) == 4:
        return board_transform( board_transform( move, transform_key[:2]), transform_key[2:])
    (r,c) = move
    if transform_key == 'lr':
        return (r, 18 - c)
    elif transform_key == 'td':
        return (18 - r, c)
    elif transform_key == 'le':
        return (c, 18 - r)
    elif transform_key == 'ri':
        return (18 - c, r)
    else:
        print( 'ERROR: unknown transform %s' % transform_key)
        exit(1)

#------------------------------------------------------------------------
def game_zobrist( moves, zobrist_moves = 40):
    'Get orientation invariant zobrist hash from 0 based (r,c) pairs'
    zobrist = 0
    for transform_key in ['0','lr','td','ri','le','letd','ritd','lrtd']:
        game_state = goboard.GameState.new_game( BOARD_SIZE)
        for idx,move in enumerate(moves):
            if idx >= zobrist_moves: break
            if move == 'pass':
                next_move = goboard.Move.pass_turn()
            elif move == 'resign':
                next_move = goboard.Move.resign()
            else:
                move = board_transform( move, transform_key)
                next_move = goboard.Move.play( gotypes.Point( move[0]+1, move[1]+1))
            game_state = game_state.apply_move( next_move)
        #print( game_state.board.zobrist_hash())
        zobrist = max( game_state.board.zobrist_hash(), zobrist)
    return zobrist
