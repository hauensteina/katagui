from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField
from wtforms.fields.html5 import EmailField
from wtforms.validators import InputRequired, DataRequired, Length, Email, EqualTo

class RegistrationForm( FlaskForm):
    username = StringField( 'Username',
                            validators=[DataRequired(), Length(min=2, max=20)])
    email = EmailField( 'Email', validators=[DataRequired(), Email()])
    fname = StringField( 'First Name', validators=[DataRequired()])
    lname = StringField( 'Last Name', validators=[DataRequired()])
    password = PasswordField( 'Password', validators=[DataRequired()])
    confirm_password = PasswordField( 'Confirm Password', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Sign Up')

class LoginForm( FlaskForm):
    email = EmailField( 'Email', validators=[DataRequired(), Email()])
    password = PasswordField( 'Password', validators=[DataRequired()])
    remember = BooleanField( 'Remember Me')
    submit = SubmitField('Login')

class RequestResetForm(FlaskForm):
    email = EmailField('Email',
                        validators=[DataRequired(), Email()])
    submit = SubmitField('Request Password Reset')

class ResetPasswordForm(FlaskForm):
    password = PasswordField('Password', validators=[DataRequired()])
    confirm_password = PasswordField('Confirm Password',
                                     validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Reset Password')

class UpdateAccountForm(FlaskForm):
    username = StringField('Username')
    email = EmailField('Email')
    fname = StringField( 'First Name', validators=[DataRequired()])
    lname = StringField( 'Last Name', validators=[DataRequired()])
    submit = SubmitField('Update')
