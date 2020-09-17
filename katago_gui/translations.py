
from pdb import set_trace as BP
from flask_login import current_user

def translate( txt, lang=None):
    '''
    Translate txt into the current user's language.
    Used in Jinja templates.
    '''
    if not lang:
        u = current_user
        try:
            lang = u.data.get( 'lang', 'eng')
        except:
            lang = 'eng'
    try:
        tab = _langdict.get( lang, _langdict['eng'])
        res = tab.get( txt, txt)
    except:
        res = txt
    return res

def donation_blurb( mobile):
    '''
    Return html asking people for money.
    Used in Jinja templates.
    '''
    DONATED = 55+26+15+5+21+10+50+10+20+21+5+10+21+30+5+5+25+10+100+20+19+29+21+20+20+31+20+20+10+120+25+25+100
    LIMIT = 2000
    frac = DONATED / LIMIT
    pct = round( 100 * frac)
    restpct = str(100 - pct) + '%'
    tstr = str(DONATED) + ' / ' + str(LIMIT) + ' ' + translate( 'dollars')
    fontsize = '10pt'
    height = '20px'
    if mobile :
      fontsize = '20pt'
      height = '40px'

    res = f'''
    <table> <tr><td colspan=3 align='center'>
    {translate( 'donation_blurb')}
    <tr><td colspan=3 align='center'> <br>
    {translate( 'donation_status')} {tstr}
    </td></tr>
    <tr>
    <td width=20%></td>
    <td>
    <div class='progress' style='font-size:{fontsize};height:{height}'>
    <div class='progress-bar' role='progressbar' style='width:{pct}%' aria-valuenow={DONATED} aria-valuemin='0' aria-valuemax={LIMIT}></div>
    {pct} </div>
    </td>
    <td width=20%></td>
    </tr>
    </table>
    '''
    res = res.replace( "#AMOUNT", str(LIMIT))
    res = res.replace( "#REST", restpct)
    return res


def get_translation_table():
    ''' The translation table itself, to be sent to the browser. '''
    return _langdict

_eng = {
    # Donation
    'donation_blurb': "To keep KataGo up and running, we need a dedicated server. A total of #AMOUNT dollars will do it. Only #REST to go! You know you want this. If you donate over 20 dollars, I'll buy you a beer when you visit me in California."
    ,'donation_status':'Status (updated daily):'
    # Registration dance
    ,'visit_link_activate':'To activate your Katagui account, visit the following link:'
    ,'register_ignore':'If you did not register, you can safely ignore this email.'
    ,'visit_link_password':'To reset your Katagui password, visit the following link:'
    ,'password_ignore':'If you did not request a password change, you can safely ignore this email.'
    ,'not_verified':'This email has not been verified.'
    ,'login_failed':'Login Unsuccessful. Please check email and password.'
    ,'account_exists':'An account with this email already exists.'
    ,'guest_invalid':'Guest is not a valid username.'
    ,'name_taken':'That username is taken.'
    ,'err_create_user':'Error creating user.'
    ,'email_sent':'An email has been sent to verify your address.<br>Make sure to check your Spam folder.'
    ,'email_verified':'Your email has been verified!<br>You are now able to log in.'
    ,'email_not_exists':'An account with this email does not exist.'
    ,'reset_email_sent':'An email has been sent with instructions to reset your password.'
    ,'password_updated':'Your password has been updated!<br>You are now able to log in'
    ,'account_updated':'Your account has been updated.'
    ,'invalid_token':'That is an invalid or expired token.'
    ,'dollars':'dollars'
}

_kor = {
    # Top Bar
    'Account':'계정'
    ,'Account Info':'계정 정보'
    ,'Logout':'로그아웃'
    ,'Login':'로그인'
    ,'Register':'등록'
    ,'About':'어바웃'
    # Buttons
    ,'Play':'플레이'
    ,'New Game':'새로운 게임'
    ,'Play':'플레이'
    ,'Best':'베스트'
    ,'Undo':'무르기'
    ,'Pass':'패스'
    ,'Score':'스코어'
    ,'Back 10':'뒤로 10'
    ,'Prev':'이전'
    ,'Next':'다음'
    ,'Fwd 10':'앞으로 10'
    ,'First':'처음'
    ,'Last':'마지막'
    ,'Save Sgf':'Sgf 파일 저장'
    ,'Load Sgf':'Sgf 파일 업로드'
    ,'Back to Main Line':'메인으로 돌아가기'
    ,'Auto Play':'자동 플레이'
    ,'Self Play':'셀프 플레이'
    ,'Self Play Speed:':'셀프 플레이 속도:'
    ,'Fast':'빠른'
    ,'Medium':'매질'
    ,'Slow':'느린'
    # Starting a Game
    ,'Handicap':'접바둑'
    ,'Komi':'덤'
    ,'Guest (10 blocks)':'게스트 (10 블럭)'
    ,'Fast (20 blocks)':'패스트 (20 블럭)'
    ,'Strong (40 blocks)':'스트롱 (40 블럭)'
    # Login and Registration
    ,'Guest':'게스트'
    ,'Please Log In':'로그인 해주세요'
    ,'Email':'이메일'
    ,'Password':'비밀번호'
    ,'Request Password Reset':'비밀번호 재설정 요청'
    ,'Password':'비밀번호'
    ,'Confirm Password':'비밀번호 확인'
    ,'Remember Me':'로그인 정보 저장'
    ,'Forgot Password?':'비밀번호 복구?'
    ,'Need An Account?':'계정이 필요하세요?'
    ,'Sign Up Now.':'지금 등록하세요.'
    ,'Already Have An Account?':'계정이 있으신가요?'
    ,'Sign In.': '로그인 해주세요.'
    ,'Username':'사용자 이름'
    ,'First Name':'성을 제외한 이름'
    ,'Last Name':'성'
    ,'Email':'이메일'
    ,'Sign Up':'등록'
    # Misc
    ,'Settings':'셋팅'
    ,'Show emoji during play':'플레이 중 이모지 보이기'
    ,'Show probability during play':'플레이 중 착수 가능성 퍼센티지 보이기'
    ,'Save':'저장'
    ,'P(B wins)':'P(흑 기준)'
    ,'KataGo resigns. You beat Katago!':'카타고가 불계를 선언했습니다. 카타고에계 승리했습니다!'
    ,'KataGo resigns.':'카타고가 불계를 선언했습니다.'
    ,'KataGo passes. Click on the Score button.':'카타고가 패스 하였습니다. 스코어 버튼을 클릭해주세요.'
    ,'KataGo is thinking ...':'카타고가 생각 중입니다.'
    ,'KataGo is counting ...':'카타고가 스코어 중입니다.'
    ,'dollars':'달러'
    # Donation
    ,'donation_blurb': '카타고 운영을 위해 전용 서버를 구축하려면 총 2000 달러 정도의 비용이 소모됩니다. 목표 달성까지 74%가 남았습니다! 카타고 운영을 위해 후원을 고려해주세요. 20달러 이상 후원시 캘리포니아에 방문하면 맥주 한 잔을 사드립니다.'
    ,'donation_status':'누적 (하루 1회 업데이트 됨)'
    ,'Top Three Donors':'상위 3 명의 기부자'
    # Registration dance
    ,'visit_link_activate':'Katagui 계정을 활성화하려면 다음 링크를 방문하십시오.'
    ,'register_ignore':'등록하지 않은 경우이 이메일을 무시해도됩니다.'
    ,'visit_link_password':'Katagui 비밀번호를 재설정하려면 다음 링크를 방문하십시오.'
    ,'password_ignore':'이 요청을하지 않은 경우이 이메일을 무시하면 아무런 변화가 없습니다.'
    ,'not_verified':'이메일이 활성화 되지 않았습니다.'
    ,'login_failed':'정보가 정확하지 않습니다. 이메일과 비밀번호를 확인해주세요.'
    ,'account_exists':'이미 등록된 이메일 입니다.'
    ,'guest_invalid':'Guest를 사용자 이름으로 사용할 수 없습니다.'
    ,'name_taken':'사용자 이름이 이미 존재합니다.'
    ,'err_create_user':'계정 생성에 에러 발생.'
    ,'email_sent':'귀하의 주소를 확인하는 이메일이 발송되었습니다.'
    ,'email_verified':'계정이 활성화 되었습니다. 로그인 할 수 있습니다.'
    ,'email_not_exists':'이미 등록된 이메일 입니다.'
    ,'reset_email_sent':'비밀번호 복구 이메일이 전송 되었습니다.'
    ,'password_updated':'새로운 비밀번호가 저장 되었습니다. 로그인 할 수 있습니다.'
    ,'Reset Password':'새로운 비밀번호 설정'
    ,'account_updated':'계정이 업데이트 되었습니다.'
    ,'invalid_token':'유효하지 않거나 만료 된 토큰입니다'
    ,'W':'백'
    ,'B':'흑'
    ,'Result':'결과'
    ,'Date':'날짜'
    # Watching games
    ,'Games Today':'오늘 대국'
    ,'User':'사용자'
    ,'Moves':'수'
    ,'Idle':'대기중'
    ,'Live':'라이브'
    ,'Observers':'관전자'
    ,'Observe':'관전'
    ,'Link':'링크'
    ,'Watch':'보기'
    ,'Refresh':'재시작'
    ,'Type here':'이곳에 입력'
}

_langdict = { 'eng':_eng, 'kor':_kor }
