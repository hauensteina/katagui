

/*
 * Entry point for watching katagui games
 * AHN Aug 2020
 */

'use strict'

//=====================================================
function watch( JGO, axutil, game_hash, p_options) {
  $ = axutil.$
  const settings = axutil.settings
  const BOT = 'katago_gtp_bot'
  const BOARD_SIZE = 19
  const COLNAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T']

  var g_jrecord = new JGO.Record(BOARD_SIZE)
  var g_jsetup = new JGO.Setup(g_jrecord.jboard, JGO.BOARD.largeWalnut)
  var g_ko = null // ko coordinate
  var g_last_move = null // last move coordinate
  var g_best_btn_buffer = false // buffer one best btn click
  var g_click_coord_buffer = null // buffer one board click
  // prisoner count; elt 0 unused; prisoners[1] counts the white stones who are B's prisoners;
  var g_prisoners = [0,0,0] 

  //================
  // UI Callbacks
  //================

  // BLACK or WHITE depending on grec.pos()
  //------------------------------------------
  function turn( idx_) {
    var idx = idx_ || grec.pos()
    if (idx % 2) {
      return JGO.WHITE
    }
    return JGO.BLACK
  } // turn()

  //----------------------------------------
  function board_click_callback( coord) {
    toggle_live_button( 'off')
    if (coord.i < 0 || coord.i > 18) { return }
    if (coord.j < 0 || coord.j > 18) { return }
    if (score_position.active) { goto_move( grec.pos()); return }
    var jboard = g_jrecord.jboard
    if ((jboard.getType(coord) == JGO.BLACK) || (jboard.getType(coord) == JGO.WHITE)) { return }
    if (axutil.hit_endpoint('waiting')) {
      g_click_coord_buffer = coord
      return
    }
    // clear hover away
    hover()

    // Add the new move in a variation
    handle_variation( 'save')
    var mstr = axutil.jcoord2string( coord)
    grec.push( {'mv':mstr, 'p':0.0, 'agent':'human'})
    goto_move( grec.len())
    set_emoji()
    const show_emoji = true
    get_prob_genmove( (data)=>{}, show_emoji)
  } // board_click_callback()

  //-------------------------------
  function best_btn_callback() {
    toggle_live_button( 'off')
    set_status( tr('KataGo is thinking ...'))
    best_btn_callback.active = true
    get_best_move( (data) => {
      show_best_moves(data)
    })
  } // best_btn_callback()
  best_btn_callback.active = false

  //----------------------------------
  function show_best_moves( data) {
    if (data) { show_best_moves.data = data }
    data = show_best_moves.data
    var botCoord = axutil.string2jcoord( data.bot_move)
    var best = data.diagnostics.best_ten // candidate moves sorted descending by psv
    var node = g_jrecord.createNode( true)
    replay_moves( grec.pos()) // remove artifacts, preserve mark on last play
    var mmax = 0
    // Mark candidates with letters if psv is close enough to max
    var bardata = []
    for (const [idx,m] of best.entries()) {
      bardata.push( [idx,m.psv])
      if (mmax == 0) { mmax = m.psv }
      if (!settings('show_best_ten') && m.psv < 0.05 * mmax) continue
      var botCoord1 = axutil.string2jcoord( m.move)
      if (botCoord1 != 'pass' && botCoord1 != 'resign') {
        var letter = String.fromCharCode('A'.charCodeAt(0) + idx)
        node.setMark( botCoord1, letter)
      }
    } // for
    var maxi = Math.max( ... bardata.map( function(d) { return d[1] }))
    console.log(maxi)
    var font = '10px sans-serif'
    if (p_options.mobile) { font = '20px sans-serif' }
    axutil.barchart( '#status', bardata, 1.2 * maxi, font)
    // Also show score and winning prob
    var scorestr = get_scorestr(data.diagnostics.winprob, data.diagnostics.score)
    $('#bestscore').html(scorestr)
    $('#bestscore').css({'font':'10px sans-serif'})    
    if (p_options.mobile) { $('#bestscore').css({'font':'20px sans-serif'}) }
  } // show_best_moves()
  show_best_moves.data = {}

  // Make a string like 'P(B wins): 0.56  B+0.5'
  //----------------------------------------------
  function get_scorestr( p, score) {
    score = Math.trunc( Math.abs(score) * 2 + 0.5) * Math.sign(score) / 2.0
    var scorestr = '&nbsp;&nbsp;' + tr('B') + '+'
    if (score < 0) {
      scorestr = '&nbsp;&nbsp;' + tr('W') + '+'
    }
    scorestr += Math.abs(score)
    var res = tr('P(B wins)') + ': ' + p.toFixed(2)
    if (typeof(score) !== 'undefined') {
      res += scorestr
    }
    if (p == 0 && score == 0) { res = '' }
    return res
  } // get_scorestr()

  //---------------------------
  function resize_board() {
    if (p_options.mobile) { return }
    var dimsleft = $('#tdleft')[0].getBoundingClientRect()
    var dimsright = $('#tdright')[0].getBoundingClientRect()
    var bwidth = $(window).width() - dimsleft.width - dimsright.width
    var bheight = $(window).height() * 0.8
    var scale = Math.min( bwidth, bheight) / 550
    if (scale < 0.7) scale = 0.7
    var tstr = 'scale(' + scale + ')'
    $('#board').css({
      'transform-origin':'center center',
      'transform': tstr
    })

    var dimsb = $('#board')[0].getBoundingClientRect()
    var dimstd = $('#tdboard')[0].getBoundingClientRect()
    var dimsinfo = $('#game_info')[0].getBoundingClientRect()
    var dx = dimstd.left - dimsb.left + 10
    var dy = dimstd.top - dimsb.top + dimsinfo.height
    tstr = 'translate(' + dx + 'px,' + dy + 'px) ' + 'scale(' + scale + ')'
    $('#board').css({
      'transform-origin':'center center',
      'transform': tstr
    })
    dimsb = $('#board')[0].getBoundingClientRect()
    $('#chat_output').css( 'height', dimsb.height)
    $('#divinfo').css( 'top', dimsb.bottom) // bottom line
    $('#divinfo').css( 'width', dimsb.width)
    $('#game_info').css( 'width', dimsb.width + 30) // top line
    $('#divinfo').css( 'left', dimsb.left + 10)

  } // resize_board()

  //-------------------------
  function setup_jgo() {
    g_jsetup.setOptions({stars: {points:9}})
    // Add mouse event listeners for the board
    //------------------------------------------
    g_jsetup.create('board',
                    function(canvas) {
                      //----------------------------
                      canvas.addListener( 'click', function(coord, ev) { board_click_callback( coord) } );

                      //------------------------------
                      canvas.addListener( 'mousemove',
                                          function( coord, ev) {
                                            var jboard = g_jrecord.jboard
                                            if (coord.i == -1 || coord.j == -1) { return }
                                            if (coord == hover.coord) { return }
                                            hover( coord, turn())
                                            if (score_position.active) { draw_estimate( score_position.probs) }
                                            else if (best_btn_callback.active) { show_best_moves() }
                                          }
                                        ) // mousemove

                      //----------------------------
                      canvas.addListener( 'mouseout',
                                          function(ev) {
                                            hover()
                                            if (score_position.active) {
                                              draw_estimate( score_position.probs)
                                            }
                                            else if (best_btn_callback.active) {
                                              show_best_moves()
                                            }
                                          }
                                        ) // mouseout
                      resize_board();
                      setTimeout( resize_board, 2000) // why, oh why do I need this?
                      window.onresize = resize_board
                    }) // create board
  } // setup_jgo()

  // Set button callbacks
  //------------------------------
  function set_btn_handlers() {
    var_button_state( 'off')

    $('#btn_tgl_live').click( () => {
      toggle_live_button( 'toggle')
      var_button_state('off')
      reload_game()
    })

    $('#btn_clear_var').click( () => {
      if ($('#btn_clear_var').hasClass('disabled')) { return }
      handle_variation( 'clear')
    })

    $('#btn_best').click( () => {
      toggle_live_button( 'off');
      if (score_position.active) return
      if (axutil.hit_endpoint('waiting')) {
        g_best_btn_buffer = true; return
      }
      best_btn_callback()
    })

    $('#btn_save').click( () => {
      toggle_live_button( 'off')
      var rec = axutil.moves_only( grec.all_moves())
      var probs = axutil.probs_only( grec.all_moves())
      var scores = axutil.scores_only( grec.all_moves())
      for (var i=0; i < probs.length; i++) { probs[i] = probs[i].toFixed(2) }
      for (var i=0; i < scores.length; i++) { scores[i] = scores[i]?scores[i].toFixed(1):'0.0' }
      // Kludge to manage passes
      for (var i=0; i < rec.length; i++) {
        if (rec[i] == 'pass') { rec[i] = 'A0' }
      }
      var moves = rec.join('')
      probs = probs.join(',')
      if (moves.length == 0) { return }
      var meta = {}
      meta.komi = grec.komi
      var url = '/save-sgf?q=' + Math.random() +
            '&moves=' + encodeURIComponent(moves) +
            '&probs=' + encodeURIComponent(probs) +
            '&scores=' + encodeURIComponent(scores) +
            '&pb=' + encodeURIComponent(meta.pb) +
            '&pw=' + encodeURIComponent(meta.pw) +
            '&km=' + encodeURIComponent(meta.komi) +
            '&re=' + encodeURIComponent(meta.RE) +
            '&dt=' + encodeURIComponent(meta.DT)

      window.location.href = url
    })

    $('#btn_nnscore').click( () => {
      toggle_live_button( 'off')
      if (score_position.active) {
        goto_move( grec.pos())
        return
      }
      score_position()
    })

    $('#btn_prev').click( btn_prev)
    $('#btn_next').click( btn_next)
    $('#btn_back10').click( () => { toggle_live_button( 'off'); goto_move( grec.pos() - 10); update_emoji() })
    $('#btn_fwd10').click( () => { toggle_live_button( 'off'); goto_move( grec.pos() + 10); update_emoji() })
    $('#btn_first').click( () => { toggle_live_button( 'off'); goto_move(0); set_emoji(); clear_status() })
    $('#btn_last').click( () => { toggle_live_button( 'off'); goto_move( grec.len()); update_emoji() })

    // Prevent zoom on double tap
    $('*').on('touchend',(e)=>{
      // Exceptions
      if (e.target.name == 'submit') { return }
      if (e.target.localName == 'canvas') { return }
      //if (e.target.className.includes('modal')) { window.alert(e.target.id); return }
      if (e.target.className.includes('btn-file')) { return }
      if (e.target.className.includes('touch-allow')) { return }
      if (e.target.className.includes('btn-primary')) { return }
      if (e.target.className.includes('close')) { return }
      if (e.target.className.includes('dropdown')) { return }
      if (e.target.className.includes('slider round')) { return }
      // Nothing else reacts
      e.preventDefault()
    })
    // Links should still work
    $('a').on('touchend',(e)=>{
      e.preventDefault()
      e.target.click()})
    // Buttons should still work
    $('[id^=btn_]').on('touchstart',(e)=>{
      e.preventDefault()
      e.target.click()
      if (e.target.id.indexOf('_tgl_') <= 0) {
        $(e.target).css( 'background-color', '#040404')
        setTimeout( ()=>{
          $(e.target).css( 'background-color', '#CCCCCC')
        } , 100)
      }
    })
  } // set_btn_handlers()

  //----------------------------
  function show_game_info() {
    try {
      var user = grec.username
      var komi = grec.komi
      var handicap = grec.handicap
      var idle_msecs = new Date() - grec.ts_latest_move
      var idletime = new Date( idle_msecs).toISOString().substr(11, 8)
      var idlestr = ''
      if (p_options.live == 1 && toggle_live_button() == 'on') {
        idlestr = `<td align='left' width='30%'>${tr('Idle')}: ${idletime} </td>`
      }
      var tstr = `<table width='80%' class='center'><tr>
                 <td>${tr('User')}: ${user}&nbsp;</td>
                 <td>${tr('Komi')}: ${komi}&nbsp;</td>
                 <td>${tr('Handicap')}: ${handicap}&nbsp;</td>
                 ${idlestr}
                 </tr></table>`
      $('#game_info').html( tstr)
    }
    catch( error) {
      console.log( 'show_game_info exception')
    }
  } // show_game_info()

  //-------------------------
  function btn_prev() {
    toggle_live_button( 'off');
    goto_move( grec.pos() - 1); update_emoji();
  }

  //-------------------------
  function btn_next() {
    toggle_live_button( 'off');
    if (btn_next.waiting) { btn_next.buffered = true; btn_next.waiting = false; return }
    goto_move( grec.pos() + 1)
    // Do not analyze handicap stones
    if (grec.pos() < 20 && grec.len() > grec.pos() && grec.nextmove().mv == 'pass') {
      goto_move( grec.pos() + 1)
      return
    }
    if (grec.curmove().p == 0) {
      btn_next.waiting = true
      get_prob_genmove( (data) => {
        update_emoji()
        btn_next.waiting = false
        if (btn_next.buffered) {
          btn_next.buffered = false
          btn_next()
        }
      })
      return
    }
    update_emoji()
  } // btn_next()
  btn_next.waiting = false
  btn_next.buffered = false

  // Get or set live/refresh button state.
  //---------------------------------------------
  function toggle_live_button( action) {
    const $btn = $('#btn_tgl_live')
    if (!action) {
      if ($btn.hasClass('ahaux_on')) {
        return 'on'
      }
      else {
        return 'off'
      }
    }
    if (action == 'on') {
      $btn.addClass('ahaux_on')
      $btn.css('background-color', '#e00000')
      $btn.css('color', 'black')
      $btn.html( tr('Live'))
    }
    else if (action == 'off') {
      $btn.removeClass('ahaux_on')
      $btn.css('background-color', 'rgb(40, 167, 69)')
      $btn.css('color', 'black')
      $btn.html( tr('Refresh'))
    }
    else if (action == 'toggle') {
      if (toggle_live_button() == 'on') { return toggle_live_button( 'off') }
      return toggle_live_button( 'on')
    }
    return 0
  } // toggle_live_button()

  // Key actions
  //------------------------
  function check_key(e) {
    e = e || window.event;
    //console.log(e.keyCode)
    if (e.keyCode == '17') { // ctrl
      check_key.ctrl_pressed = true
      return
    }
    else if (e.keyCode == '37') { // left arrow
      btn_prev()
    }
    else if (e.keyCode == '39') { // right arrow
      btn_next()
    }
    check_key.ctrl_pressed = false
  } // check_key()
  check_key.ctrl_pressed = false

  //===================
  // Bot Interaction
  //===================

  // Do things after the bot came back with move and estimate
  //------------------------------------------------------------
  function bot_move_callback( data) {
    hover() // The board thinks the hover stone is actually there. Clear it.
    var botprob = data.diagnostics.winprob; var botcol = 'Black'
    if (turn() == JGO.WHITE) { botprob = 1.0 - botprob; botcol = 'White' }

    if (data.bot_move == 'pass') {
      alert( tr('KataGo passes. Click on the Score button.'))
      clear_status()
    }
    else if (data.bot_move == 'resign') {
      alert( tr('KataGo resigns.'))
      set_status( tr('KataGo resigns.'))
      return
    }
    else if ( (var_button_state() == 'off') && (grec.pos() > 150) && ( // do not resign in variation or too early
      (grec.handicap < 3 && botprob < 0.01) ||
        (grec.handicap < 2 && botprob < 0.02) ||
        (botprob < 0.001))
              && (data.diagnostics.score > 10.0) // Do not resign unless B has a 10 point lead
            )
    {
      alert( tr('KataGo resigns. You beat KataGo!'))
      set_status( tr('KataGo resigns.'))
      return
    }
    else {
      maybe_start_var()
    }
    grec.push( { 'mv':data.bot_move, 'p':0.0, 'score':0.0, 'agent':'bot' } )
    //show_move( turn(), botCoord, 0.0, 'bot')
    replay_moves( grec.pos())
    show_movenum()
    const show_emoji = true
    get_prob_callback( data.diagnostics.winprob, data.diagnostics.score, show_emoji)
  } // bot_move_callback()

  //========
  // Moves
  //========

  // Show a move on the board
  //------------------------------------
  function show_move(player, coord) {
    if (coord == 'pass' || coord == 'resign') {
      g_ko = false
      return
    }
    var play = g_jrecord.jboard.playMove( coord, player, g_ko)
    if (play.success) {
      var node = g_jrecord.createNode( true)
      node.info.captures[player] += play.captures.length // tally captures
      g_prisoners[player] = node.info.captures[player]
      node.setType( coord, player) // play stone
      node.setType( play.captures, JGO.CLEAR) // clear opponent's stones

      if (g_last_move) {
        node.setMark( g_last_move, JGO.MARK.NONE) // clear prev move
      }
      if (g_ko) {
        node.setMark( g_ko, JGO.MARK.NONE) // clear previous ko mark
      }
      node.setMark( coord, JGO.MARK.CIRCLE) // mark move
      g_last_move = coord

      if(play.ko)
        node.setMark (play.ko, JGO.MARK.CIRCLE) // mark ko, too
      g_ko = play.ko
    }
  } // show_move()

  //------------------------
  function goto_first_move() {
    g_ko = false
    g_last_move = false
    grec.seek(0)
    g_jrecord.jboard.clear()
    g_jrecord.root = g_jrecord.current = null
    show_movenum()
  } // goto_first_move()

  // The active game has ended.
  //----------------------------
  function end_game() {
    settings('game_hash', '')
  } // end_game()

  // Replay n moves from empty board.
  //------------------------------------
  function replay_moves( n) {
    var jboard = g_jrecord.jboard
    goto_first_move()
    for (const [idx, move_prob] of grec.prefix(n).entries()) {
      var move_string = move_prob.mv
      var coord = axutil.string2jcoord( move_string)
      show_move( turn(idx), coord)
    }
    grec.seek(n)
    show_movenum()
  } // replay_moves()

  // Replay and show game up to move n
  //-------------------------------------
  function goto_move( n) {
    n = Math.max( n, 2 * grec.handicap)
    score_position.active = false
    best_btn_callback.active = false
    var totmoves = grec.len()
    if (n < 1) { goto_first_move(); set_emoji(); return }
    if (n > totmoves) { n = totmoves }
    replay_moves( n)
    show_movenum()
    show_prob()
    $('#debug').html( JSON.stringify(grec.curmove()) + '<br>var:' + grec.var_active() + ' move ' + n )
    if ( grec.curmove().agent == 'kata10') {
      fast_or_strong('guest')
    } else if ( grec.curmove().agent == 'kata20') {
      fast_or_strong('fast')
    } else if ( grec.curmove().agent == 'kata40') {
      fast_or_strong('strong')
    } else {
      fast_or_strong('human')
    }
  } // goto_move()

  //----------------------------
  function show_movenum() {
    if (!grec.len()) { return }
    var totmoves = grec.len()
    var n = grec.pos()
    var html = `${n} / ${totmoves}<br>`
    html += tr('B') + `:${g_prisoners[1]} `
    html += tr('W') + `:${g_prisoners[2]} `
    $('#movenum').html(html)
  } // show_movenum()

  //======================
  // Variation handling
  //======================

  // Make a variation, or restore from var, or forget var
  //--------------------------------------------------------
  function handle_variation( action) {
    if (action == 'save') { // Save record and start a variation
      grec.enter_var()
      var_button_state('on')
    }
    else if (action == 'clear') { // Restore game record and forget the variation
      grec.exit_var()
      goto_move( grec.pos())
      update_emoji();
      var_button_state('off')
      clear_status()
    }
  } // handle_variation()

  // Start a variation if we're not at the end
  //---------------------------------------------
  function maybe_start_var() {
    if (grec.len() && grec.pos() < grec.len()) {
      handle_variation( 'save')
    }
  } // maybe_start_var()

  //-------------------------------------------
  function var_button_state( state) {
    if (!state) {
      if ($('#btn_clear_var').hasClass('disabled')) {
        return 'off'
      }
      else {
        return 'on'
      }
    }
    if (state == 'on') {
      $('#btn_clear_var').removeClass('disabled')
      $('#btn_clear_var').addClass('btn-success')
      $('#btn_clear_var').css('color', 'black')
      $('#btn_clear_var').css('background-color', '')
    }
    else {
      $('#btn_clear_var').addClass('disabled')
      $('#btn_clear_var').removeClass('btn-success')
      $('#btn_clear_var').css('color', 'black')
    }
    return 0
  } // var_button_state()


  //======================
  // Winning probability
  //======================

  // Get current winning probability from genmove
  //-------------------------------------------------------------
  function get_prob_genmove( completion, update_emo) {
    set_status( tr( 'Counting ...'))
    axutil.hit_endpoint( fast_or_strong().ep + BOT,
                         {'board_size': BOARD_SIZE, 'moves': axutil.moves_only( grec.board_moves()), 'config':{'komi': grec.komi } },
                         (data) => {
                           get_prob_callback( data.diagnostics.winprob, data.diagnostics.score, update_emo)
                           if (completion) { completion(data) }
                         })
  } // get_prob_genmove()

  // Continue after prob and score came back from the server
  //-------------------------------------------------------------------
  function get_prob_callback( winprob, score, update_emo) {
    if (grec.pos()) {
      var p = parseFloat( winprob)
      var score = parseFloat( score)
      grec.update( p, score)
      if (settings( 'game_hash')) { // we are in an active game
      }
    }
    show_prob( update_emo)
    if (g_click_coord_buffer) { // user clicked while waiting, do it now
      board_click_callback( g_click_coord_buffer)
      g_click_coord_buffer = null
    }
    else if (g_best_btn_buffer) { // Buffered play button click
      best_btn_callback()
      g_best_btn_buffer = false
    }
  } // get_prob_callback()

  // Get the best move
  //----------------------------------------------------------
  function get_best_move( completion) {
    set_status( tr('KataGo is thinking ...'))
    axutil.hit_endpoint( '/select-move-x/' + BOT,
                         {'board_size': BOARD_SIZE, 'moves': axutil.moves_only( grec.board_moves()), 'config':{'komi': grec.komi } },
                         (data) => {
                           if (completion) { completion(data) }
                         })
  } // get_best_move()

  //------------------------------------------
  function show_prob( update_emo) {
    var cur = grec.curmove()
    if (cur) {
      var p = cur.p
      var score = cur.score
      // 0.8 -> 1.0; 1.3 -> 1.5 etc
      score = Math.trunc( Math.abs(score) * 2 + 0.5) * Math.sign(score) / 2.0
      if (p == 0 && score == 0) {
        set_emoji(); clear_status()
        return
      }
      var scorestr = get_scorestr(p,score)
      set_status(scorestr)
      
      // Show emoji
      if (update_emo) { update_emoji() }
    } else {
      clear_status()
    }
  } // show_prob()

  const HAPPY_POINT_LOSS_MAX = 2.0
  //--------------------------
  function update_emoji() {
    var cur = grec.curmove()
    var prev = grec.prevmove()
    if (!cur) { return }
    var p = cur.p
    var score = cur.score
    if (p == 0) { set_emoji(); return }
    if (prev) {
      if (cur.mv == 'pass') {  set_emoji(); return }
      if (prev.mv == 'pass') {  set_emoji(); return }
      if (prev.p == 0) {  set_emoji(); return }
      var pp = prev.p
      var pscore = prev.score
      if ((grec.pos() - 1) % 2) { // we are white
        p = 1.0 - p; pp = 1.0 - pp
        score *= -1; pscore *= -1
      }
      var delta_p = pp - p
      var delta_score = pscore - score
      if (p < 0.05 && delta_p < 0.06) { set_emoji() } // empty
      else if (p > 0.95 && delta_score < HAPPY_POINT_LOSS_MAX) { set_emoji(0.0, 0) } // happy
      else if (pp == 0) { set_emoji() } // empty
      else { set_emoji( delta_p, delta_score) }
    }
    else {
      set_emoji()
    }
  } // update_emoji()

  //-----------------------------------------------
  function set_emoji( delta_prob, delta_score) {
    var emo_id = '#emo'
    if (typeof delta_prob == 'undefined') {
      $(emo_id).html( '&nbsp;')
      return
    }
    const MOVE_EMOJI = ['😍','😐','😓','😡']
    var emo = MOVE_EMOJI[3]

    // Get angry if we lose winning probability
    const PROB_BINS = [0.03, 0.06, 0.1]
    var prob_idx
    for (prob_idx=0; prob_idx < PROB_BINS.length; prob_idx++) {
      if (delta_prob < PROB_BINS[prob_idx]) break;
    }
    // Get angry if we lose points
    const SCORE_BINS = [HAPPY_POINT_LOSS_MAX, 4, 8]
    var score_idx
    for (score_idx=0; score_idx < SCORE_BINS.length; score_idx++) {
      if (delta_score < SCORE_BINS[score_idx]) break;
    }

    // Choose whichever is angrier
    emo = MOVE_EMOJI[ Math.max( prob_idx, score_idx)]
    $(emo_id).html( emo)
  } // set_emoji()

  //==========
  // Scoring
  //==========

  // Score the current position with katago.
  //-------------------------------------------
  function score_position() {
    set_status( 'Scoring...')
    axutil.hit_endpoint( '/score/' + BOT,
                         {'board_size': BOARD_SIZE, 'moves': axutil.moves_only( grec.board_moves()), 'config':{'komi':grec.komi }, 'tt':Math.random() },
                         (data) => {
                           score_position.active = true
                           score_position.probs = data.probs
                           draw_estimate( data.probs)
                           get_prob_genmove( function() {}, false, false )
                         } // (data) =>
                       ) // hit_endpoint()
  } // score_position()
  score_position.active = false
  score_position.probs = []

  // Draw black and white squares with alpha representing certainty
  //------------------------------------------------------------------
  function draw_estimate( probs) {
    var node = g_jrecord.createNode( true)
    for (const [idx, prob] of probs.entries()) {
      var row = BOARD_SIZE - Math.trunc( idx / BOARD_SIZE)
      var col = (idx % BOARD_SIZE) + 1
      var coord = axutil.rc2jcoord( row, col)
      if (prob < 0) { // white
        node.setMark( coord, 'WP:' + Math.trunc(Math.abs(prob)*100))
      } // for
      else { // black
        node.setMark( coord, 'BP:' + Math.trunc(Math.abs(prob)*100))
      } // for
    } // for
  } // draw_estimate()

  //=======
  // Misc
  //=======

  //----------------------------
  function clear_status() {
    $('#status').html('')
    $('#bestscore').html('')    
  }

  //----------------------------
  function set_status(x) {
    clear_status()
    $('#status').html(x)    
  }

  // Show a translucent hover stone
  //---------------------------------
  function hover( coord, col, opts) {
    opts = opts || {}
    if (!opts.force) {
      if (p_options.mobile && col) { return }
    }
    var hcol = col ? col: turn()
    var jboard = g_jrecord.jboard
    if (jboard.getType( coord) == JGO.WHITE || jboard.getType( coord) == JGO.BLACK) { return }
    if (coord) {
      if (hover.coord) {
        jboard.setType( hover.coord, JGO.CLEAR)
      }
      jboard.setType( coord, hcol == JGO.WHITE ? JGO.DIM_WHITE : JGO.DIM_BLACK)
      hover.coord = coord
      if (col) {
        replay_moves( grec.pos()) // remove artifacts
        jboard.setType( coord, hcol == JGO.WHITE ? JGO.DIM_WHITE : JGO.DIM_BLACK)
      }
    }
    else if (hover.coord) {
      jboard.setType( hover.coord, JGO.CLEAR)
      hover.coord = null
      replay_moves( grec.pos()) // remove artifacts
    }
  } // hover()
  hover.coord = null

  // Get or set fast or strong mode
  //---------------------------------------
  function fast_or_strong( val) {
    if (typeof val == 'undefined') { // getter
      if ($('#descr_bot').html().indexOf('Pro') >= 0) {
        return fast_or_strong('strong')
      } else if ($('#descr_bot').html().indexOf('20b') >= 0) {
        return fast_or_strong('fast')
      } else if ($('#descr_bot').html().indexOf('10b') >= 0) {
        return fast_or_strong('guest')
      } else if ($('#descr_bot').html().indexOf('Human') >= 0) {
        return fast_or_strong('human')
      }
    } // if getter
    // setter
    if (val == 'strong') {
      $('#descr_bot').html( `KataGo Pro 1000`)
      $('#img_bot').attr('src', 'static/kata-red.png')
      return {'val':'strong', 'ep':'/select-move-x/' }
    } else if (val == 'fast') {
      $('#descr_bot').html( `KataGo 20b &nbsp; 256`)
      $('#img_bot').attr('src', 'static/kata.png')
      return {'val':'fast', 'ep':'/select-move/' }
    } else if (val == 'guest') {
      $('#descr_bot').html( `KataGo 10b &nbsp; 256`)
      $('#img_bot').attr('src', 'static/kata.png')
      return {'val':'guest', 'ep':'/select-move-guest/' }
    } else if (val == 'human') {
      $('#descr_bot').html( `Human`)
      $('#img_bot').attr('src', 'static/kata-gray.png')
      return {'val':'human', 'ep':'/select-move/' }
    }
    return 0
  } // fast_or_strong()

  // Reload game from DB
  //--------------------------
  function reload_game() {
    grec.dbload( game_hash, ()=>{
      goto_move( grec.pos())
    })
  } // reload_game()

  //=======================
  //=== Chat input form
  //=======================

  $('#chat_input_form').on('submit', (e) => {
    e.preventDefault();
    var msg = $('#chat_input_text')[0].value
    if (!msg.trim()) { return }
    axutil.hit_endpoint_simple( '/chat', {'game_hash':game_hash, 'msg':msg}, (resp) => {})
    $('#chat_input_text')[0].value = ''
  })

  //=======================
  //=== Websockets Rule!
  //=======================

  // Support TLS-specific URLs, when appropriate.
  var ws_scheme = 'ws://'
  if (window.location.protocol == 'https:') { ws_scheme = 'wss://' }
  var observer_socket = new ReconnectingWebSocket( ws_scheme + location.host + '/register_socket/' + game_hash)

  // Websocket callback to react to server push messages.
  // This triggers when redis.publish(json.dumps(data)) gets called in routes_api.py.
  observer_socket.onmessage = function(message) {
    var data = JSON.parse(message.data)
    var action = data.action
    var game_hash = data.game_hash
    if (action == 'update_game') {
      var gr = new GameRecord()
      gr.from_dict( data.game_data)
      update_game( 'update_game', game_hash, data.nmoves, data.client_timestamp, gr)
    }
    else if (action == 'chat') {
      var msg = data.msg
      var username = data.username
      $('#chat_output').append( '<span style="color:green">' + username + '</span>: ' + msg + '<br>')
      $('#chat_output').scrollTop( $('#chat_output').prop('scrollHeight')) // autoscroll
    }
  } // onmessage()

  // Receive update to the game from onmessage() when a new socket even comes in.
  //---------------------------------------------------------------------------------
  function update_game( action, game_hash, nmoves, client_timestamp, gr) {
    console.log( 'action: ' + action)
    if (toggle_live_button() == 'off') { return }
    if (action == 'update_game') {
      console.log( 'update game nmoves ' + nmoves + ' pos ' + update_game.pos)
      if (client_timestamp < update_game.timestamp) {
        console.log( 'update_game(): outdated update message, ignored')
        return
      }
      update_game.timestamp = client_timestamp
      if (nmoves - update_game.pos > 5) {
        console.log('reset forwards')
        update_game.pos = nmoves - 1
        update_game.gamerecords = []
      }
      else if (update_game.pos > nmoves - 1) {
        console.log('reset backwards')
        update_game.pos = nmoves - 1
        update_game.gamerecords = []
      }

      for (var i = update_game.pos+1; i <= nmoves; i++) {
	gr.seek( i)
	update_game.gamerecords.push( gr.clone())
        console.log( 'pushing move ' + gr.pos())
      }
      update_game.pos = nmoves
    }
    // Place new stones with delay between moves for easier watching
    else if (action == 'replay_with_delay') {
      if (update_game.gamerecords.length == 0) {
	return
      }
      var gre = update_game.gamerecords.shift()
      grec = gre.clone()
      goto_move( grec.pos())
      console.log( 'replay move ' + grec.pos())
      const update_emo = true; show_prob( update_emo)
    } // replay_with_delay
  } // update_game()
  update_game.gamerecords = []
  update_game.timer = setInterval( ()=>{ update_game( 'replay_with_delay') }, 1000)
  update_game.timestamp = 0
  update_game.pos = 0

  $(window).on( 'beforeunload', () => {
    observer_socket.close()
    localStorage.setItem( 'chat', $('#chat_output').html() )
    // normal fetch will not execute in unload
    navigator.sendBeacon( '/clear_watch_game', {})
  })

  settings()

  // Update some things once a second
  //-------------------------------------
  function once_per_sec() {
    show_game_info()
    clearTimeout( once_per_sec.timer)
    once_per_sec.timer = setTimeout( once_per_sec, 1000)
  }
  once_per_sec.timer = null

  //====================================================================
  //== Get some data from the server, i.e. translations and user data,
  //== plus the game we are watching.
  //====================================================================

  var grec = new GameRecord()
  var serverData = new ServerData( axutil, ()=>{
    grec.dbload( game_hash, ()=>{
      set_btn_handlers()
      document.onkeydown = check_key
      goto_move( grec.pos())
      toggle_live_button( 'on')
      if (!p_options.live) {
        // If game over, show the longer of record and var_record
        if (grec.var_record.length > grec.record.length) {
          grec.exit_var()
        }
      }
      once_per_sec()
      //fast_or_strong( 'fast')
    })
    if (settings( 'chat_hash') == game_hash) { // restore chat if same game
      $('#chat_output').html( localStorage.getItem( 'chat') )
    }
    else { // different game, forget chat
      $('#chat_output').html('')
      localStorage.setItem( 'chat', '')
      settings( 'chat_hash', game_hash)
    }
    setup_jgo()
  }) // new ServerData

  function tr( text) { if (serverData) { return serverData.translate( text) } return text }

} // function watch()
