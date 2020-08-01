from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField
from wtforms.fields.html5 import EmailField
from wtforms.validators import InputRequired, DataRequired, Length, Email, EqualTo
from katago_gui.translations import translate as tr

from pdb import set_trace as BP

class RegistrationForm( FlaskForm):
    username = StringField( 'Username',
                            validators=[DataRequired(), Length(min=2, max=20)])
    email = EmailField( 'Email', validators=[DataRequired(), Email()])
    fname = StringField( 'First Name', validators=[DataRequired()])
    lname = StringField( 'Last Name', validators=[DataRequired()])
    password = PasswordField( 'Password', validators=[DataRequired()])
    confirm_password = PasswordField( 'Confirm Password', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Sign Up')

    @classmethod
    def translate( cclass):
        ''' Call this from routes.py to translate to current language setting '''
        cclass.username = StringField( tr('Username'),
                                       validators=[DataRequired(), Length(min=2, max=20)])
        cclass.email = EmailField( tr('Email'), validators=[DataRequired(), Email()])
        cclass.fname = StringField( tr('First Name'), validators=[DataRequired()])
        cclass.lname = StringField( tr('Last Name'), validators=[DataRequired()])
        cclass.password = PasswordField( tr('Password'), validators=[DataRequired()])
        cclass.confirm_password = PasswordField( tr('Confirm Password'), validators=[DataRequired(), EqualTo('password')])
        cclass.submit = SubmitField(tr('Sign Up'))

class LoginForm( FlaskForm):
    email = EmailField( 'Email', validators=[DataRequired(), Email()])
    password = PasswordField( 'Password', validators=[DataRequired()])
    remember = BooleanField( 'Remember Me')
    submit = SubmitField('Login')

    @classmethod
    def translate( cclass):
        ''' Call this from routes.py to translate to current language setting '''
        cclass.email = EmailField( tr('Email'), validators=[DataRequired(), Email()])
        cclass.password = PasswordField( tr('Password'), validators=[DataRequired()])
        cclass.remember = BooleanField( tr('Remember Me'))
        cclass.submit = SubmitField( tr('Login'))

class RequestResetForm(FlaskForm):
    email = EmailField('Email',
                        validators=[DataRequired(), Email()])
    submit = SubmitField('Request Password Reset')

    @classmethod
    def translate( cclass):
        ''' Call this from routes.py to translate to current language setting '''
        cclass.email = EmailField( tr('Email'), validators=[DataRequired(), Email()])
        cclass.submit = SubmitField( tr('Request Password Reset'))

class ResetPasswordForm(FlaskForm):
    password = PasswordField('Password', validators=[DataRequired()])
    confirm_password = PasswordField('Confirm Password',
                                     validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Reset Password')

    @classmethod
    def translate( cclass):
        ''' Call this from routes.py to translate to current language setting '''
        cclass.password = PasswordField( tr('Password'), validators=[DataRequired()])
        cclass.confirm_password = PasswordField( tr('Confirm Password'),
                                                 validators=[DataRequired(), EqualTo('password')])
        cclass.submit = SubmitField( tr('Reset Password'))

class UpdateAccountForm(FlaskForm):
    username = StringField('Username')
    email = EmailField('Email')
    fname = StringField( 'First Name', validators=[DataRequired()])
    lname = StringField( 'Last Name', validators=[DataRequired()])
    submit = SubmitField('Update')

    @classmethod
    def translate( cclass):
        ''' Call this from routes.py to translate to current language setting '''
        cclass.username = StringField( tr('Username'))
        cclass.email = EmailField( tr('Email'))
        cclass.fname = StringField( tr('First Name'), validators=[DataRequired()])
        cclass.lname = StringField( tr('Last Name'), validators=[DataRequired()])
        cclass.submit = SubmitField( tr('Save'))
