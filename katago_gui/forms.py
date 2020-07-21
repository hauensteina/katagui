from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField
from wtforms.validators import InputRequired, DataRequired, Length, Email, EqualTo

class RegistrationForm( FlaskForm):
    username = StringField( 'Username',
                            validators=[InputRequired(message='Field required'), Length(min=2, max=20)])
    email = StringField( 'Email', validators=[DataRequired(), Email()])
    fname = StringField( 'First Name', validators=[DataRequired()])
    lname = StringField( 'Last Name', validators=[DataRequired()])
    password = PasswordField( 'Password', validators=[DataRequired()])
    confirm_password = PasswordField( 'Confirm Password', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Sign Up')

class LoginForm( FlaskForm):
    email = StringField( 'Email', validators=[DataRequired(), Email()])
    password = PasswordField( 'Password', validators=[DataRequired()])
    remember = BooleanField( 'Remember Me')
    submit = SubmitField('Login')

class RequestResetForm(FlaskForm):
    email = StringField('Email',
                        validators=[DataRequired(), Email()])
    submit = SubmitField('Request Password Reset')

class ResetPasswordForm(FlaskForm):
    password = PasswordField('Password', validators=[DataRequired()])
    confirm_password = PasswordField('Confirm Password',
                                     validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Reset Password')
