# /********************************************************************
# Filename: katago-gui/katago_gui/routes.py
# Author: AHN
# Creation Date: Jul, 2020
# **********************************************************************/
#
# Template and static file routes
#
from pdb import set_trace as BP

import os, sys, re, json

from flask import request, render_template, flash, redirect, url_for, session
from flask_login import login_user, current_user, login_required
from flask_mail import Message
#from itsdangerous import TimedJSONWebSignatureSerializer as Serializer
from itsdangerous.url_safe import URLSafeTimedSerializer as Serializer

from katago_gui import app, bcrypt, mail, logged_in
from katago_gui import auth
from katago_gui.translations import translate as tr
from katago_gui.forms import LoginForm, RegistrationForm, RequestResetForm, ResetPasswordForm, UpdateAccountForm
from katago_gui.helpers import check_https, login_as_guest, send_reset_email, send_register_email, moves2sgf, moves2arr 

@app.route('/ttest')
#-------------------------------
def ttest():
    """ Try things here """
    # msg = Message('Python test',
    #               sender='hauensteina@ahaux.com',
    #               recipients=['hauensteina@gmail.com'])
    # msg.body = 'hi there from python'
    # ret = mail.send(msg)
    return render_template( 'ttest.tmpl', msg='ttest')

@app.route('/')
@app.route('/index')
@app.route('/home')
#-------------------------------
def index():
    """ Main entry point """
    if not check_https(): return redirect( 'https://katagui.baduk.club')
    if not current_user.is_authenticated: login_as_guest()
    return render_template( 'index.tmpl', home=True)

@app.route('/index_mobile')
#-------------------------------
def index_mobile():
    """ Main entry point for mobile devices """
    if not check_https(): return redirect( 'https://katagui.baduk.club')
    if not current_user.is_authenticated: login_as_guest()
    return render_template( 'index_mobile.tmpl', home=True)

@app.route('/about')
#-------------------------------
def about():
    return render_template( 'about.tmpl')

@app.route('/account', methods=['GET', 'POST'])
@login_required
#-------------------
def account():
    UpdateAccountForm.translate()
    form = UpdateAccountForm()
    if form.validate_on_submit():
        current_user.data['fname'] = form.fname.data.strip().strip()
        current_user.data['lname'] = form.lname.data.strip().strip()
        current_user.update_db()
        flash( tr( 'account_updated'), 'success')
        return redirect(url_for('account'))
    elif request.method == 'GET':
        form.username.data = current_user.data['username']
        form.email.data = current_user.data['email']
        form.fname.data = current_user.data['fname']
        form.lname.data = current_user.data['lname']
    return render_template('account.tmpl', title='Account', form=form)

@app.route('/export_diagram')
#-------------------------------
def export_diagram():
    """ Export part of the board as a diagram """
    parms = dict(request.args)
    stones = parms['stones']
    marks = parms['marks']
    moves = parms['moves']
    moves = moves2arr( moves)
    pb = parms['pb']
    pw = parms['pw']
    km = parms['km']
    re = parms['re']
    dt = parms['dt']
    meta = {'pb':pb, 'pw':pw, 'km':km, 're':re, 'dt':dt}
    sgf = moves2sgf( moves, [], [], meta)
    return render_template( 'export_diagram.tmpl', stones=stones, marks=marks, sgf=sgf)

@app.route('/favicon.ico')
#-------------------------------
def favicon():
    return app.send_static_file( 'favicon.ico')

@app.route('/flash_only', methods=['GET'])
#--------------------------------------------------------
def flash_only():
    return render_template('flash_only.tmpl')

@app.route('/login', methods=['GET','POST'])
#---------------------------------------------
def login():
    if logged_in():
        return redirect( url_for('index'))
    LoginForm.translate()
    form = LoginForm()
    if form.validate_on_submit():
        user = auth.User( form.email.data)
        if user.valid and user.password_matches( form.password.data):
            if not user.email_verified():
                flash(tr('not_verified'), 'danger')
                return redirect( url_for('login'))
            login_user(user, remember=form.remember.data)
            next_page = request.args.get('next') # Magically populated to where we came from
            return redirect(next_page) if next_page else redirect(url_for('index'))
        else:
            flash(tr('login_failed'), 'danger')
    res = render_template('login.tmpl', title='Login', form=form)
    return res

@app.route('/register', methods=['GET','POST'])
#------------------------------------------------
def register():
    if logged_in():
        return redirect(url_for('index'))
    RegistrationForm.translate()
    form = RegistrationForm()
    if form.validate_on_submit():
        formname = form.username.data.strip()
        formemail = form.email.data.strip().lower()
        user = auth.User( formemail)
        if formname.lower().startswith('guest'):
            flash( tr('guest_invalid'), 'danger')
            return render_template('register.tmpl', title='Register', form=form)
        if user.valid:
            if user.data['username'] != formname:
                flash( tr('account_exists'), 'danger')
                return render_template('register.tmpl', title='Register', form=form)

        hashed_password = bcrypt.generate_password_hash(form.password.data).decode('utf-8')
        user_data = {'username':form.username.data
                     ,'fname':form.fname.data
                     ,'lname':form.lname.data
                     ,'email_verified':False
        }
        ret = user.createdb( user_data)
        if ret == 'err_user_exists':
            user.update_db()
            #flash( tr('name_taken'), 'danger')
            #return render_template('register.tmpl', title='Register', form=form)
        elif ret != 'ok':
            flash( tr('err_create_user'), 'danger')
            return render_template('register.tmpl', title='Register', form=form)
        user.set_password( form.password.data)
        send_register_email( user)
        flash( tr('email_sent'), 'info')
        return redirect(url_for('flash_only'))
    return render_template('register.tmpl', title='Register', form=form)

@app.route('/reset_request', methods=['GET', 'POST'])
#--------------------------------------------------------
def reset_request():
    if logged_in():
        return redirect( url_for('home'))
    RequestResetForm.translate()
    form = RequestResetForm()
    if form.validate_on_submit():
        user = auth.User( form.email.data)
        if not user.valid:
            flash( tr('email_not_exists'), 'danger')
            return render_template('register.tmpl', title='Register', form=form)
        send_reset_email( user)
        flash( tr('reset_email_sent'), 'info')
        return redirect(url_for('login'))
    return render_template('reset_request.tmpl', title='Reset Password', form=form)

@app.route('/reset_token/<token>', methods=['GET', 'POST'])
#----------------------------------------------------------------
def reset_token(token):
    if logged_in():
        return redirect( url_for('index'))
    s = Serializer(app.config['SECRET_KEY'])
    user_id = s.loads(token)['user_id']
    lang = s.loads(token)['lang']
    user = auth.User( user_id)
    if not user.valid:
        flash( tr( 'invalid_token', 'warning'))
        return redirect( url_for('reset_request'))
    ResetPasswordForm.translate( lang)
    form = ResetPasswordForm()
    if form.validate_on_submit():
        user.set_password( form.password.data)
        flash( tr( 'password_updated'), 'success')
        return redirect(url_for('login'))
    return render_template('reset_token.tmpl', title='Reset Password', form=form)

@app.route("/set_mobile", methods=['GET','POST'])
#---------------------------------------------------
def set_mobile():
    parms = get_parms()
    url = parms['url']
    mobile_flag = True if parms['mobile_flag'].lower() == 'true' else False
    session['is_mobile'] = mobile_flag
    return redirect(url)

# @app.route('/settings')
# #-------------------------------
# def settings():
#     return render_template( 'settings.tmpl')

@app.route('/verify_email/<token>', methods=['GET', 'POST'])
#-------------------------------------------------------------
def verify_email(token):
    """ User clicked on email verification link. """
    s = Serializer(app.config['SECRET_KEY'])
    user_id = s.loads(token)['user_id']
    user = auth.User( user_id)
    user.set_email_verified()
    flash( tr( 'email_verified'), 'success')
    return redirect(url_for('flash_only'))

#------------------
def get_parms():
    if request.method == 'POST': # Form submit
        parms = dict(request.form)
    else:
        parms = dict(request.args)
    # strip all parameters    
    parms = { k:v.strip() for k, v in parms.items()}
    print(f'>>>>>>>>>PARMS:{parms}')
    return parms

