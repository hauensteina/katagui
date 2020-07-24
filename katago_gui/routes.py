# /********************************************************************
# Filename: katago-gui/katago_gui/routes.py
# Author: AHN
# Creation Date: Jul, 2020
# **********************************************************************/
#
# URL Endpoints
#

from pdb import set_trace as BP
import os, sys, re, json
import requests
from datetime import datetime
import uuid
from io import BytesIO

from flask import jsonify, request, send_file, render_template, flash, redirect, url_for
from flask_login import login_user, current_user, logout_user, login_required
from flask_mail import Message
from itsdangerous import TimedJSONWebSignatureSerializer as Serializer

from katago_gui.gotypes import Point
from katago_gui.sgf import Sgf_game
from katago_gui.go_utils import coords_from_point

from katago_gui import app, db, bcrypt, mail
from katago_gui import auth
from katago_gui.forms import LoginForm, RegistrationForm, RequestResetForm, ResetPasswordForm, UpdateAccountForm
from katago_gui.helpers import get_sgf_tag, fwd_to_katago, fwd_to_katago_x, fwd_to_katago_guest, moves2sgf

@app.route('/')
@app.route('/index')
@app.route('/home')
#-------------------------------
def index():
    return render_template( 'index.tmpl', mobile=False, home=True)

@app.route('/index_mobile')
#-------------------------------
def index_mobile():
    return render_template( 'index_mobile.tmpl', mobile=True, home=True)

@app.route('/help')
#---------------------
def help():
    return render_template( 'help.tmpl', mobile=False)
@app.route('/help_mobile')

#--------------------
def help_mobile():
    return render_template( 'help.tmpl', mobile=True)

@app.route('/login', methods=['GET','POST'])
#---------------------------------------------
def login():
    if current_user.is_authenticated:
        return redirect( url_for('index'))
    form = LoginForm()
    if form.validate_on_submit():
        user = auth.User( form.email.data)
        if user.valid and user.auth( form.password.data):
            if not user.email_verified():
                flash('This email has not been verified.', 'danger')
                return redirect( url_for('login'))
            login_user(user, remember=form.remember.data)
            next_page = request.args.get('next') # Magically populated to where we came from
            return redirect(next_page) if next_page else redirect(url_for('index'))
        else:
            flash('Login Unsuccessful. Please check email and password', 'danger')
    return render_template('login.tmpl', title='Login', form=form)

@app.route("/logout")
#-------------------------
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/register', methods=['GET','POST'])
#------------------------------------------------
def register():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    form = RegistrationForm()
    if form.validate_on_submit():
        user = auth.User( form.email.data)
        if form.username.data.strip().lower() == 'guest':
            flash( 'Guest is not a valid username.', 'danger')
            return render_template('register.tmpl', title='Register', form=form)
        if user.valid:
            flash( 'An account with this email already exists.', 'danger')
            return render_template('register.tmpl', title='Register', form=form)

        jjson = user.json()
        jjson.update( {'email_verified':True})
        hashed_password = bcrypt.generate_password_hash(form.password.data).decode('utf-8')
        user_data = {'username':form.username.data
                     ,'email':form.email.data
                     ,'password':hashed_password
                     ,'fname':form.fname.data
                     ,'lname':form.lname.data
                     ,'json':json.dumps( jjson)
        }
        user.create( user_data)
        #send_register_email( user)
        flash('Account has been created. Please log in.', 'info')
        return redirect(url_for('login'))
    return render_template('register.tmpl', title='Register', form=form)

#-------------------------------
def send_register_email( user):
    ''' User register. Send him an email to verify email address before creating account. '''
    expires_sec = 1800
    s = Serializer( app.config['SECRET_KEY'], expires_sec)
    token = s.dumps( {'user_id': user.id}).decode('utf-8')
    msg = Message('Katagui Email Verification',
                  sender='hauensteina@ahaux.com',
                  recipients=[user.data['email']])
    msg.body = f'''To activate your Katagui account, visit the following link:
    {url_for('verify_email', token=token, _external=True)}

    If you did not register a Katagui account, you can safely ignore this email.
    '''
    mail.send(msg)

@app.route("/verify_email/<token>", methods=['GET', 'POST'])
#-------------------------------------------------------------
def verify_email(token):
    ''' User clicked on email verification link. '''
    s = Serializer(app.config['SECRET_KEY'])
    user_id = s.loads(token)['user_id']
    user = auth.User( user_id)
    jjson = user.json()
    jjson.update( {'email_verified':True} )
    db.update_row( 't_user', 'email', user.data['email'], { 'json':json.dumps( jjson) })
    flash('Your email has been verified! You are now able to log in', 'success')
    return redirect(url_for('login'))

#------------------------------
def send_reset_email( user):
    ''' User requested a password reset. Send him an email with a reset link. '''
    expires_sec = 1800
    s = Serializer( app.config['SECRET_KEY'], expires_sec)
    token = s.dumps( {'user_id': user.id}).decode('utf-8')
    msg = Message('Password Reset Request',
                  sender='noreply@ahaux.com',
                  recipients=[user.data['email']])
    msg.body = f'''To reset your katagui password, visit the following link:
    {url_for('reset_token', token=token, _external=True)}

    If you did not make this request then simply ignore this email and no changes will be made.
    '''
    mail.send(msg)

@app.route("/reset_request", methods=['GET', 'POST'])
#--------------------------------------------------------
def reset_request():
    if current_user.is_authenticated:
        return redirect( url_for('home'))
    form = RequestResetForm()
    if form.validate_on_submit():
        user = auth.User( form.email.data)
        if not user.valid:
            flash( 'An account with this email does not exist.', 'danger')
            return render_template('register.tmpl', title='Register', form=form)
        send_reset_email( user)
        flash('An email has been sent with instructions to reset your password.', 'info')
        return redirect(url_for('login'))
    return render_template('reset_request.tmpl', title='Reset Password', form=form)

@app.route("/reset_token/<token>", methods=['GET', 'POST'])
#----------------------------------------------------------------
def reset_token(token):
    if current_user.is_authenticated:
        return redirect( url_for('index'))
    s = Serializer(app.config['SECRET_KEY'])
    user_id = s.loads(token)['user_id']
    user = auth.User( user_id)
    if not user.valid:
        flash('That is an invalid or expired token', 'warning')
        return redirect( url_for('reset_request'))
    form = ResetPasswordForm()
    if form.validate_on_submit():
        hashed_password = bcrypt.generate_password_hash( form.password.data).decode('utf-8')
        user.data['password'] = hashed_password
        db.update_row( 't_user', 'email', user.data['email'], { 'password':hashed_password })
        flash('Your password has been updated! You are now able to log in', 'success')
        return redirect(url_for('login'))
    return render_template('reset_token.tmpl', title='Reset Password', form=form)

@app.route("/account", methods=['GET', 'POST'])
@login_required
#-------------------
def account():
    form = UpdateAccountForm()
    if form.validate_on_submit():
        current_user.data['fname'] = form.fname.data.strip().strip()
        current_user.data['lname'] = form.lname.data.strip().strip()
        db.update_row( 't_user', 'email', current_user.id, current_user.data)
        flash('Your account has been updated!', 'success')
        return redirect(url_for('account'))
    elif request.method == 'GET':
        form.username.data = current_user.data['username']
        form.email.data = current_user.data['email']
        form.fname.data = current_user.data['fname']
        form.lname.data = current_user.data['lname']
    return render_template('account.tmpl', title='Account', form=form)

@app.route('/about')
#-------------------------------
def about():
    return render_template( 'about.tmpl')

@app.route('/settings')
#-------------------------------
def settings():
    return render_template( 'settings.tmpl')

@app.route('/favicon.ico')
#-------------------------------
def favicon():
    return app.send_static_file( 'favicon.ico')

@app.route('/select-move/<bot_name>', methods=['POST'])
# Forward select-move to the katago server
#------------------------------------------
def select_move( bot_name):
    endpoint = 'select-move/' + bot_name
    args = request.json
    res = fwd_to_katago( endpoint, args)
    try:
        return jsonify( res)
    except:
        print( 'select move error: %s' % res)

@app.route('/select-move-x/<bot_name>', methods=['POST'])
# Forward select-move to the katago server
#------------------------------------------
def select_move_x( bot_name):
    endpoint = 'select-move/' + bot_name
    args = request.json
    res = fwd_to_katago_x( endpoint, args)
    try:
        return jsonify( res)
    except:
        print( 'select move x error: %s' % res)

@app.route('/select-move-guest/<bot_name>', methods=['POST'])
# Forward select-move to the katago server
#------------------------------------------
def select_move_guest( bot_name):
    endpoint = 'select-move/' + bot_name
    args = request.json
    res = fwd_to_katago_guest( endpoint, args)
    try:
        return jsonify( res)
    except:
        print( 'select move guest error: %s' % res)

@app.route('/score/<bot_name>', methods=['POST'])
# Forward score to the katago server
#------------------------------------------
def score( bot_name):
    endpoint = 'score/' + bot_name
    args = request.json
    res = fwd_to_katago( endpoint, args)
    return jsonify( res)

@app.route('/slog', methods=['POST'])
# Log a message
#----------------------------------------------------
def slog():
    msg = request.json.get( 'msg', 'empty_msg')
    print( 'slog: %s' % msg)
    return jsonify( {'result': 'ok' })

@app.route('/sgf2list', methods=['POST'])
# Convert sgf main var to coordinate list of moves
#----------------------------------------------------
def sgf2list():
    f = request.files['file']
    sgfstr = f.read()
    #sgfstr = sgfstr.decode('ascii', errors='ignore')
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

@app.route('/save-sgf', methods=['GET'])
# Convert moves to sgf and return as file attachment.
# Moves come like 'Q16D4...' to shorten URL.
#-------------------------------------------------------------
def save_sgf():
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
