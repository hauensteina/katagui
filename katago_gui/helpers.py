# /********************************************************************
# Filename: katago-gui/katago_gui/helpers.py
# Author: AHN
# Creation Date: Jul, 2020
# **********************************************************************/
#
# Various utility functions
#

from katago_gui import KATAGO_SERVER, KATAGO_SERVER_X, KATAGO_SERVER_GUEST
from katago_gui.go_utils import point_from_coords
import requests
import os, sys, re
from datetime import datetime
from flask import request

#-------------------------
def check_https():
    protocol = request.headers.get('X-Forwarded-Proto', 'http')
    if protocol != 'https' and 'HEROKU_FLAG' in os.environ:
        return False
    return True

#--------------------------------
def get_sgf_tag( sgfstr, tag):
    rexp = r'.*' + tag + r'\[([^\[]*)\].*'
    tstr = sgfstr.decode('utf8')
    res = re.sub(rexp, r'\1', tstr ,flags=re.DOTALL)
    if res == tstr: return '' # tag not found
    return res

# Forward request to katago server
#----------------------------------------
def fwd_to_katago( endpoint, args):
    url = KATAGO_SERVER + endpoint
    resp = requests.post( url, json=args)
    res = resp.json()
    return res

# Forward request to katago server
#----------------------------------------
def fwd_to_katago_x( endpoint, args):
    url = KATAGO_SERVER_X + endpoint
    resp = requests.post( url, json=args)
    res = resp.json()
    return res

# Forward request to katago server
#----------------------------------------
def fwd_to_katago_guest( endpoint, args):
    url = KATAGO_SERVER_GUEST + endpoint
    resp = requests.post( url, json=args)
    res = resp.json()
    return res

# Convert a list of moves like ['Q16',...] to sgf
#---------------------------------------------------
def moves2sgf( moves, probs, scores, meta):
    meta = { k : ('' if v == 'undefined' else v) for (k,v) in meta.items() }
    sgf = '(;FF[4]SZ[19]\n'
    sgf += 'SO[katago-one-playout.herokuapp.com]\n'
    dtstr = meta['dt']
    if not dtstr: dtstr = datetime.now().strftime('%Y-%m-%d')
    km = meta['km']
    if not km: km = '7.5'

    sgf += 'PB[%s]\n' % meta['pb']
    sgf += 'PW[%s]\n' % meta['pw']
    sgf += 'RE[%s]\n' % meta['re']
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
        elif move == 'A0':
            movestr += ';%s[tt]' % color
        else:
            #BP()
            p = point_from_coords( move)
            col_s = 'abcdefghijklmnopqrstuvwxy'[p.col - 1]
            row_s = 'abcdefghijklmnopqrstuvwxy'[19 - p.row]
            movestr += ';%s[%s%s]' % (color,col_s,row_s)
            if idx < len(probs):
                movestr += 'C[P:%s S:%s]' % (probs[idx], scores[idx])
        color = othercol

    sgf += result
    sgf += movestr
    sgf += ')'
    return sgf
