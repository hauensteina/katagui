
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
    DONATED = 55+26+15+5+21+10+50+10+20+21+5+10+21+30+5+5+25+10+100+20+19+29+21+20+20+31+20+20+10+120+25+25+100+10+20+5+5+36+50+100+20+20
    DONATED += 20+20
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
    # Buttons
    'Play':'AI Play'
    # Donation
    ,'donation_blurb': "To keep KataGo up and running, we need a dedicated server. A total of #AMOUNT dollars will do it. Only #REST to go! You know you want this. If you donate over 20 dollars, I'll buy you a beer when you visit me in California."
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
    ,'New Game':'새로운 게임'
    ,'Play':'AI 플레이'
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
    ,'Show best 10 (A-J)':'베스트 10 보이기 (A-J)'
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
    ,'donation_blurb': '카타고 운영을 위해 전용 서버를 구축하려면 총 2000 달러 정도의 비용이 소모됩니다. 목표 달성까지 #REST가 남았습니다! 카타고 운영을 위해 후원을 고려해주세요. 20달러 이상 후원시 캘리포니아에 방문하면 맥주 한 잔을 사드립니다.'
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
    # Search Game
    ,'Search':'검색'
    ,'Find a Game Played on KataGui':'KataGui에서 기보 찾기'
    ,'Started':'시작'
    ,'Ended':'종료'
    ,'Try Again':'다시 시도'
    ,'Game Not Found':'기보를 찾을 수 없음'
}

_chinese = {
# Top Bar
    'Account':'我的帐号'
    ,'Account Info':'帐号个人信息'
    ,'Logout':'退出登录'
    ,'Login':'登录'
    ,'Register':'注册'
    ,'About':'关于KataGui'
    # Buttons
    ,'Play':'落子'
    ,'New Game':'新对局'
    ,'Play':'AI落子'
    ,'Best':'最佳推荐'
    ,'Undo':'悔棋'
    ,'Pass':'停一手'
    ,'Score':'点目'
    ,'Back 10':'上10手'
    ,'Prev':'上一手'
    ,'Next':'下一手'
    ,'Fwd 10':'下10手'
    ,'First':'始'
    ,'Last':'终'
    ,'Save Sgf':'保存SGF'
    ,'Load Sgf':'载入'
    ,'Back to Main Line':'返回主分支'
    ,'Auto Play':'自动落子'
    ,'Self Play':'自动落子'
    ,'Self Play Speed:':'自动落子速度:'
    ,'Fast':'快'
    ,'Medium':'中'
    ,'Slow':'慢'
    # Starting a Game
    ,'Handicap':'让子'
    ,'Komi':'贴目'
    ,'Guest (10 blocks)':'预览版 (10b)'
    ,'Fast (20 blocks)':'轻巧版 (20b)'
    ,'Strong (40 blocks)':'强力版 (40b)'
    # Login and Registration
    ,'Guest':'游客'
    ,'Please Log In':'请登录'
    ,'Email':'电子邮箱'
    ,'Password':'密码'
    ,'Request Password Reset':'请求重置密码'
    ,'Password':'密码'
    ,'Confirm Password':'确认密码'
    ,'Remember Me':'记住我'
    ,'Forgot Password?':'忘记密码？'
    ,'Need An Account?':'需要帐号？'
    ,'Sign Up Now.':'现在就可以注册。'
    ,'Already Have An Account?':'已经有了帐号？'
    ,'Sign In.': '请登录。'
    ,'Username':'用户名'
    ,'First Name':'名字'
    ,'Last Name':'姓氏'
    ,'Email':'电子邮箱'
    ,'Sign Up':'注册新帐号'
    # Misc
    ,'Settings':'设置'
    ,'Show best 10 (A-J)':'显示最佳的10点 (A-J)'
    ,'Show emoji during play':'对局中显示表情'
    ,'Show probability during play':'对局中显示胜率'
    ,'Save':'保存'
    ,'P(B wins)':'黑方胜率'
    ,'KataGo resigns. You beat Katago!':'KataGo认输了。你击败了KataGo！'
    ,'KataGo resigns.':'KataGo认输了。'
    ,'KataGo passes. Click on the Score button.':'KataGo停了一手，请开始数目。'
    ,'KataGo is thinking ...':'KataGo正在思考中...'
    ,'KataGo is counting ...':'KataGo正在计算中...'
    ,'dollars':'美元'
    # Donation
    ,'donation_blurb': '为了长期维持KataGo的运行，我们需要购买专用的服务器。现在距离 #AMOUNT 美元的目标只剩 #REST 了！希望您也能帮助我们实现这个愿望。如果您的捐助超过20美元，您下次来加州拜访我时我一定会热情款待！'
    ,'donation_status':'目前筹得捐款（每日更新）：'
    ,'Top Three Donors':'前三名捐助者'
    # Registration dance
    ,'visit_link_activate':'请点击以下链接激活您的KataGui帐号：'
    ,'register_ignore':'如果您没有注册，请放心忽略这封邮件'
    ,'visit_link_password':'请点击以下链接重置您的KataGui密码：'
    ,'password_ignore':'如果您没有请求重置密码，请放心忽略这封邮件'
    ,'not_verified':'本电子邮箱尚未被验证'
    ,'login_failed':'登录失败，请检查您的电子邮箱或密码是否正确'
    ,'account_exists':'此电子邮箱已经被另一帐号注册'
    ,'guest_invalid':'用户名不能为Guest'
    ,'name_taken':'该用户名已被注册'
    ,'err_create_user':'创建用户时出错'
    ,'email_sent':'我们已向您的电子邮箱发送了一封确认邮件。<br>如未收到，请检查您的垃圾邮件箱。'
    ,'email_verified':'电子邮箱验证成功！<br>现在您可以登录了。'
    ,'email_not_exists':'不存在该电子邮箱相关的帐户。'
    ,'reset_email_sent':'我们已发送了一封邮件，其中包含重置密码的具体步骤。'
    ,'password_updated':'密码重置成功！<br>现在您可以登录了。'
    ,'account_updated':'帐号更新成功。'
    ,'invalid_token':'token不存在或已失效'
    ,'W':'白'
    ,'B':'黑'
    ,'Result':'结果'
    ,'Date':'日期'
    # Watching games
    ,'Games Today':'本日对局'
    ,'User':'用户'
    ,'Moves':'手数'
    ,'Idle':'空闲'
    ,'Live':'进行中'
    ,'Observers':'观众人数'
    ,'Observe':'进入'
    ,'Link':'链接'
    ,'Watch':'观战'
    ,'Refresh':'刷新'
    ,'Type here':'在此输入...'
    # Search Game
    ,'Search':'搜索'
    ,'Find a Game Played on KataGui':'寻找KataGui上的对局'
    ,'Started':'已开始'
    ,'Ended':'已结束'
    ,'Try Again':'重试'
    ,'Game Not Found':'找不到对局'
}

_langdict = { 'eng':_eng, 'kor':_kor, 'chinese':_chinese }
