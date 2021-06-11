# /********************************************************************
# Filename: katago-gui/katago_gui/helpers.py
# Author: AHN
# Creation Date: Jul, 2020
# **********************************************************************/
#
# Various utility functions
#

from pdb import set_trace as BP
import os, sys, re, uuid
import requests
from datetime import datetime
from itsdangerous import TimedJSONWebSignatureSerializer as Serializer
from flask import request, url_for
from flask_login import current_user, login_user
from flask_mail import Message

from katago_gui import app, auth, mail, db
from katago_gui import DEMO_KATAGO_SERVER
from katago_gui.go_utils import point_from_coords
from katago_gui.translations import translate as tr

#-------------------------
def check_https():
    protocol = request.headers.get('X-Forwarded-Proto', 'http')
    if protocol != 'https' and 'HEROKU_FLAG' in os.environ:
        return False
    return True

#--------------------------------
def get_sgf_tag( sgfstr, tag):
    rexp = r'.*' + tag + r'\[([^\[]*)\].*'
    #tstr = sgfstr.decode('utf8')
    res = re.sub(rexp, r'\1', sgfstr ,flags=re.DOTALL)
    if res == tag: return '' # tag not found
    return res

# Forward fast request to katago server
#----------------------------------------
def fwd_to_katago( endpoint, args):
    try:
        ip = db.get_parm( 'server_ip')
        url = 'http://' + ip + ':2819/' + endpoint
    except:
        url = DEMO_KATAGO_SERVER + '/' + endpoint
    # local testing
    #ip = '192.168.0.190'
    #url = 'http://' + ip + ':2718/' + endpoint
    resp = requests.post( url, json=args)
    try:
        res = resp.json()
    except Exception as e:
        print( 'Exception in fwd_to_katago()')
        print( 'args %s' % str(args))
    return res

# Forward strong request to katago server
#------------------------------------------
def fwd_to_katago_x( endpoint, args):
    try:
        ip = db.get_parm( 'server_ip')
        url = 'http://' + ip + ':2820/' + endpoint
    except:
        url = DEMO_KATAGO_SERVER + '/' + endpoint
    # local testing
    #ip = '192.168.0.190'
    #url = 'http://' + ip + ':2718/' + endpoint
    resp = requests.post( url, json=args)
    try:
        res = resp.json()
    except Exception as e:
        print( 'Exception in fwd_to_katago_x()')
        print( 'args %s' % str(args))
    return res

# Forward guest request to katago server
#------------------------------------------
def fwd_to_katago_guest( endpoint, args):
    try:
        ip = db.get_parm( 'server_ip')
        url = 'http://' + ip + ':2821/' + endpoint
    except:
        url = DEMO_KATAGO_SERVER + '/' + endpoint

    resp = requests.post( url, json=args)
    try:
        res = resp.json()
    except Exception as e:
        print( 'Exception in fwd_to_katago_guest()')
        print( 'args %s' % str(args))
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

#---------------------------
def login_as_guest():
    """ If we are not logged in, log in as guest """
    print('>>>>>>>>>>>>>>> login guest')
    if current_user.is_authenticated:return
    print('>>>>>>>>>>>>>>> create guest')
    uname = 'guest_' + uuid.uuid4().hex[:7]
    email = uname + '@guest.guest'
    user = auth.User( email)
    user.createdb( { 'fname':'f', 'lname':'l', 'username':uname, 'email_verified':True })
    login_user( user, remember=False)


#-------------------------------
def send_register_email( user):
    ''' User register. Send him an email to verify email address before creating account. '''
    expires_sec = 3600 * 24 * 7
    s = Serializer( app.config['SECRET_KEY'], expires_sec)
    token = s.dumps( {'user_id': user.id}).decode('utf-8')
    msg = Message('Katagui Email Verification',
                  sender='hauensteina@ahaux.com',
                  recipients=[user.data['email']])
    msg.body = f'''
{tr( 'visit_link_activate')}

{url_for('verify_email', token=token, _external=True)}

{tr( 'register_ignore')}
    '''
    mail.send(msg)

#------------------------------
def send_reset_email( user):
    ''' User requested a password reset. Send him an email with a reset link. '''
    expires_sec = 3600 * 24 * 7
    s = Serializer( app.config['SECRET_KEY'], expires_sec)
    token = s.dumps( {'user_id': user.id, 'lang':user.data.get('lang','eng') }).decode('utf-8')
    msg = Message('Password Reset Request',
                  sender='noreply@ahaux.com',
                  recipients=[user.data['email']])
    #msg.body = 'hi there testing a reset'
    tstr = f'''
{tr( 'visit_link_password')}

{url_for('reset_token', token=token, _external=True)}

{tr( 'password_ignore')}
    '''
    msg.body = tstr
    mail.send(msg)
