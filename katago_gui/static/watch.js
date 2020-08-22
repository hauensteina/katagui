

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
  //var g_play_btn_buffer = false // buffer one play btn click
  var g_best_btn_buffer = false // buffer one best btn click
  var g_click_coord_buffer = null // buffer one board click

  var g_komi = 7.5
  var g_handi = 0

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
    toggle_button( '#btn_tgl_live', 'off');
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
    var mstr = jcoord2string( coord)
    grec.push( {'mv':mstr, 'p':0.0, 'agent':'human'})
    goto_move( grec.len())
    set_emoji()
    const playing = true
    get_prob_genmove( (data)=>{}, settings('show_emoji'), playing )
  } // board_click_callback()

  //-------------------------------
  function best_btn_callback() {
    toggle_button( '#btn_tgl_live', 'off');
    $('#status').html( translate('KataGo is thinking ...'))
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
    var botCoord = string2jcoord( data.bot_move)
    var best = data.diagnostics.best_ten // candidate moves sorted descending by psv
    var node = g_jrecord.createNode( true)
    replay_moves( grec.pos()) // remove artifacts, preserve mark on last play
    var mmax = 0
    // Mark candidates with letters if psv is close enough to max
    for (const [idx,m] of best.entries()) {
      if (mmax == 0) { mmax = m.psv }
      if (m.psv < mmax / 4.0) continue
      var botCoord = string2jcoord( m.move)
      if (botCoord != 'pass' && botCoord != 'resign') {
        var letter = String.fromCharCode('A'.charCodeAt(0) + idx)
        node.setMark( botCoord, letter)
      }
    } // for
  } // show_best_moves()
  show_best_moves.data = {}

  // Black moves at the beginning are handicap
  //--------------------------------------------
  function get_handicap() {
    g_handi = 0
    var handi = 0
    var rec = grec.prefix(20)
    for (var i=0; i < rec.length; i++) {
      if (i%2) { // white
        if (rec[i].mv != 'pass') {
          break
        }
      }
      else { // black
        handi += 1
      }
    }
    if (handi > 1) {
      g_handi = handi
    }
    return g_handi
  } // get_handicap()

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
		    } // function(canvas)
		   ) // create board
  } // setup_jgo()

  // Blink a translucent stone
  //------------------------------------------
  function blink( coord, color, ms, times) {
    if (times == 0) { return }
    var ttimes = times-1
    hover( coord, color, {force:true})
    setTimeout( () => {
      hover()
      setTimeout( () => { blink( coord, color, ms, ttimes) }, ms )
    }, ms)
  } // blink()

  // Set button callbacks
  //------------------------------
  function set_btn_handlers() {
    var_button_state( 'off')

    $('#img_bot, #descr_bot').click( () => {
      fast_or_strong('toggle')
    })

    $('#btn_tgl_live').click( () => {
      toggle_button( '#btn_tgl_live', 'toggle')
      reload_game()
    })

    $('#btn_clear_var').click( () => {
      if ($('#btn_clear_var').hasClass('disabled')) { return }
      handle_variation( 'clear')
    })

    $('#btn_best').click( () => {
      toggle_button( '#btn_tgl_live', 'off');
      if (score_position.active) return
      if (axutil.hit_endpoint('waiting')) {
        g_best_btn_buffer = true; return
      }
      best_btn_callback()
    })

    $('#btn_save').click( () => {
      toggle_button( '#btn_tgl_live', 'off')
      var rec = moves_only( grec.all_moves())
      var probs = probs_only( grec.all_moves())
      var scores = scores_only( grec.all_moves())
      for (var i=0; i < probs.length; i++) { probs[i] = probs[i].toFixed(2) }
      for (var i=0; i < scores.length; i++) { scores[i] = scores[i]?scores[i].toFixed(1):'0.0' }
      // Kludge to manage passes
      for (var i=0; i < rec.length; i++) {
        if (rec[i] == 'pass') { rec[i] = 'A0' }
      }
      var moves = rec.join('')
      probs = probs.join(',')
      if (moves.length == 0) { return }
      var meta = set_load_sgf_handler.loaded_game
      if (!meta) {
        meta = {}
        meta.komi = g_komi
      }
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
      toggle_button( '#btn_tgl_live', 'off')
      if (score_position.active) {
	goto_move( grec.pos())
	return
      }
      score_position()
    })

    $('#btn_prev').click( btn_prev)
    $('#btn_next').click( btn_next)
    $('#btn_back10').click( () => { toggle_button( '#btn_tgl_live', 'off'); goto_move( grec.pos() - 10); update_emoji() })
    $('#btn_fwd10').click( () => { toggle_button( '#btn_tgl_live', 'off'); goto_move( grec.pos() + 10); update_emoji() })
    $('#btn_first').click( () => { toggle_button( '#btn_tgl_live', 'off'); goto_move(0); set_emoji(); $('#status').html( '&nbsp;') })
    $('#btn_last').click( () => { toggle_button( '#btn_tgl_live', 'off'); goto_move( grec.len()); update_emoji() })

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
      console.log('a')
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

  //-------------------------
  function btn_prev() {
    toggle_button( '#btn_tgl_live', 'off');
    goto_move( grec.pos() - 1); update_emoji();
  }

  //-------------------------
  function btn_next() {
    toggle_button( '#btn_tgl_live', 'off');
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
      alert( translate('KataGo passes. Click on the Score button.'))
      $('#status').html('')
    }
    else if (data.bot_move == 'resign') {
      alert( translate('KataGo resigns.'))
      $('#status').html( translate('KataGo resigns.'))
      return
    }
    else if ( (var_button_state() == 'off') && (grec.pos() > 150) && ( // do not resign in variation or too early
      (g_handi < 3 && botprob < 0.01) ||
	(g_handi < 2 && botprob < 0.02) ||
	(botprob < 0.001))
	      && (data.diagnostics.score > 10.0) // Do not resign unless B has a 10 point lead
	    )
    {
      alert( translate('KataGo resigns. You beat KataGo!'))
      $('#status').html( translate('KataGo resigns.'))
      return
    }
    else {
      maybe_start_var()
      //var botCoord = string2jcoord( data.bot_move)
    }
    grec.push( { 'mv':data.bot_move, 'p':0.0, 'score':0.0, 'agent':'bot' } )
    //show_move( turn(), botCoord, 0.0, 'bot')
    replay_moves( grec.pos())
    show_movenum()
    const show_emoji = false
    const playing = true
    get_prob_callback( data.diagnostics.winprob, data.diagnostics.score, show_emoji, playing)
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
      node.setType( coord, player) // play stone
      node.setType( play.captures, JGO.CLEAR) // clear opponent's stones

      if (g_last_move) {
        node.setMark( g_last_move, JGO.MARK.NONE) // clear previous mark
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

  //-----------------------
  function reset_game() {
    handle_variation( 'clear')
    set_load_sgf_handler.loaded_game = null
    show_game_info() // clear
    grec = new GameRecord()
    goto_first_move()
    if (g_handi < 2) { return }
    var hstones =  HANDISTONES[g_handi]
    for (const [idx,s] of hstones.entries()) {
      if (idx > 0) {
        grec.push( {'mv':'pass', 'p':0, 'agent':''} )
      }
      grec.push( {'mv':s, 'p':0, 'agent':''} )
    }
    goto_move( grec.len())
  } // reset_game()

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
      var coord = string2jcoord( move_string)
      show_move( turn(idx), coord)
    }
    grec.seek(n)
    show_movenum()
  } // replay_moves()

  // Replay and show game up to move n
  //-------------------------------------
  function goto_move( n) {
    n = Math.max( n, 2 * g_handi)
    score_position.active = false
    best_btn_callback.active = false
    var totmoves = grec.len()
    if (n > totmoves) { n = totmoves }
    if (n < 1) { goto_first_move(); set_emoji(); return }
    replay_moves( n)
    show_movenum()
    show_prob()
    if ( (grec.pos() != grec.len()) || grec.var_active() )  {
      $('#btn_undo').addClass( 'disabled')
    } else {
      $('#btn_undo').removeClass( 'disabled')
    }
  } // goto_move()

  //----------------------------
  function show_movenum() {
    if (!grec.len()) { return }
    var totmoves = grec.len()
    var n = grec.pos()
    $('#movenum').html( `${n} / ${totmoves}`)
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
      $('#status').html( 'Variation deleted')
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

  // Get or set button state.
  // Example: toggle_button( '#btn_tgl_live', 'on')
  //------------------------------------------------
  function toggle_button( btn, action) {
    if (!action) {
      if ($(btn).hasClass('disabled')) {
        return 'off'
      }
      else {
        return 'on'
      }
    }
    if (action == 'on') {
      $(btn).removeClass('disabled')
      $(btn).addClass('btn-success')
      $(btn).css('color', 'black')
      $(btn).css('background-color', '')
    }
    else if (action == 'off') {
      $(btn).addClass('disabled')
      $(btn).removeClass('btn-success')
      $(btn).css('color', 'black')
    }
    else if (action == 'toggle') {
      if (toggle_button( btn) == 'on') { return toggle_button( btn, 'off') }
      return toggle_button( btn, 'on')
    }
    return 0
  } // toggle_button()

  //======================
  // Winning probability
  //======================

  // Get current winning probability from genmove
  //-------------------------------------------------------------
  function get_prob_genmove( completion, update_emo, playing) {
    $('#status').html( translate( 'Counting ...'))
    axutil.hit_endpoint( fast_or_strong().ep + BOT,
			 {'board_size': BOARD_SIZE, 'moves': moves_only(grec.board_moves()), 'config':{'komi': g_komi } },
			 (data) => {
			   get_prob_callback( data.diagnostics.winprob, data.diagnostics.score, update_emo, playing)
			   if (completion) { completion(data) }
			 })
  } // get_prob_genmove()

  // Continue after prob and score came back from the server
  //-------------------------------------------------------------------
  function get_prob_callback( winprob, score, update_emo, playing) {
    if (grec.pos()) {
      var p = parseFloat( winprob)
      var score = parseFloat( score)
      grec.update( p, score)
      if (settings( 'game_hash')) { // we are in an active game
      }
    }
    show_prob( update_emo, playing)
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
  function get_best_move( completion, update_emo, playing) {
    $('#status').html( translate('KataGo is thinking ...'))
    axutil.hit_endpoint( fast_or_strong().ep + BOT,
			 {'board_size': BOARD_SIZE, 'moves': moves_only(grec.board_moves()), 'config':{'komi': g_komi } },
			 (data) => {
			   if (completion) { completion(data) }
			   $('#status').html( '')
			 })
  } // get_best_move()

  //------------------------------------------
  function show_prob( update_emo, playing) {
    var cur = grec.curmove()
    if (cur) {
      var p = cur.p
      var score = cur.score
      // 0.8 -> 1.0; 1.3 -> 1.5 etc
      score = Math.trunc( Math.abs(score) * 2 + 0.5) * Math.sign(score) / 2.0
      if (p == 0) {
        set_emoji(); $('#status').html('')
        return
      }
      if (playing && !settings('show_prob')) {
        $('#status').html('')
      } else {
        var scorestr = '&nbsp;&nbsp;' + translate('B') + '+'
        if (score < 0) {
          scorestr = '&nbsp;&nbsp;' + translate('W') + '+'
        }
        scorestr += Math.abs(score)
        var tstr = translate('P(B wins)') + ': ' + p.toFixed(2)
        if (typeof(cur.score) !== 'undefined') {
          tstr += scorestr
        }
        $('#status').html(tstr)
      }
      // Show emoji
      if (update_emo) { update_emoji() }
    } else {
      $('#status').html('')
    }
  } // show_prob()

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
      else if (p > 0.95 && delta_score < 3) { set_emoji(0.0, 0) } // happy
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
    const SCORE_BINS = [2, 4, 8]
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
    $('#status').html( 'Scoring...')
    axutil.hit_endpoint( '/score/' + BOT,
			 {'board_size': BOARD_SIZE, 'moves': moves_only(grec.board_moves()), 'config':{'komi':g_komi }, 'tt':Math.random() },
			 (data) => {
			   var winprob = parseFloat(data.diagnostics.winprob)
			   var score = parseFloat(data.diagnostics.score)
			   score = Math.trunc( Math.abs(score) * 2 + 0.5) * Math.sign(score) / 2.0
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
      var coord = rc2jcoord( row, col)
      if (prob < 0) { // white
        node.setMark( coord, 'WP:' + Math.trunc(Math.abs(prob)*100))
      } // for
      else { // black
        node.setMark( coord, 'BP:' + Math.trunc(Math.abs(prob)*100))
      } // for
    } // for
  } // draw_estimate()

  //===============
  // Converters
  //===============

  // Record has tuples (mv,p,score,agent). Turn into a list of score.
  //------------------------------------------------------------------
  function scores_only( record) {
    var res = []
    for (var move_prob of record) {
      res.push( move_prob.score)
    }
    return res
  } // scores_only()

  // Record has tuples (mv,p,agent). Turn into a list of mv.
  //----------------------------------------------------------
  function moves_only( record) {
    var res = []
    for (var move_prob of record) {
      res.push( move_prob.mv)
    }
    return res
  } // moves_only()

  // Record has tuples (mv,p,agent). Turn into a list of p.
  //----------------------------------------------------------
  function probs_only( record) {
    var res = []
    for (var move_prob of record) {
      res.push( move_prob.p)
    }
    return res
  } // probs_only()

  //--------------------------------------
  function jcoord2string( jgo_coord) {
    if (jgo_coord == 'pass' || jgo_coord == 'resign') { return jgo_coord }
    var row = (BOARD_SIZE - 1) - jgo_coord.j
    var col = jgo_coord.i
    return COLNAMES[col] + ((row + 1).toString())
  } // jcoord2string()

  //--------------------------------------
  function string2jcoord( move_string) {
    if (move_string == 'pass' || move_string == 'resign') { return move_string }
    var colStr = move_string.substring(0, 1)
    var rowStr = move_string.substring(1)
    var col = COLNAMES.indexOf(colStr)
    var row = BOARD_SIZE - parseInt(rowStr, 10)
    return new JGO.Coordinate(col, row)
  } // string2jcoord()

  // Turn a server (row, col) into a JGO coordinate
  //--------------------------------------------------
  function rc2jcoord( row, col) {
    return new JGO.Coordinate( col - 1, BOARD_SIZE - row)
  } // rc2jcoord()

  // Turn a jgo coord into a linear array index
  //----------------------------------------------
  function jcoord2idx( jcoord) {
    if (jcoord == 'pass' || jcoord == 'resign') { return -1 }
    var idx = (BOARD_SIZE - jcoord.j - 1) * BOARD_SIZE + jcoord.i
    return idx
  } // jcoord2idx()

  //=======
  // Misc
  //=======

  // Uppercase first letter
  //----------------------------
  function upperFirst( str) {
    return str[0].toUpperCase() + str.slice(1)
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

  // Get or set guest, fast, strong mode
  //---------------------------------------
  function fast_or_strong( val) {
    if (typeof val == 'undefined') { // getter
      if ($('#btn_tgl_strong').hasClass('active')) {
        return fast_or_strong('strong')
      } else if ($('#btn_tgl_fast').hasClass('active')) {
        return fast_or_strong('fast')
      } else {
        if (!settings('logged_in')) {
          return fast_or_strong('guest')
        } else { // logged in, use 20b
          return fast_or_strong('fast')
        }
      }
    } // if getter
    // setter
    if (val == 'toggle') {
      if (!settings('logged_in')) {
        return fast_or_strong( 'guest')
      } else if ($('#btn_tgl_strong').hasClass('active')) {
        return fast_or_strong('fast')
      } else {
        return fast_or_strong('strong')
      }
    }
    else if (val == 'strong' || val == 'fast') {
      if (settings( 'logged_in')) {
        if (val == 'strong') {
          $('#descr_bot').html( `KataGo 40b 1000<br>${DDATE}`)
          $('#btn_tgl_strong').addClass('active')
          $('#btn_tgl_fast').removeClass('active')
          $('#btn_tgl_guest').removeClass('active')
          $('#img_bot').attr('src', 'static/kata-red.png')
          return {'val':'strong', 'ep':'/select-move-x/' }
        } else if (val == 'fast') {
          $('#descr_bot').html( `KataGo 20b &nbsp; 256<br>${DDATE}`)
          $('#btn_tgl_fast').addClass('active')
          $('#btn_tgl_strong').removeClass('active')
          $('#btn_tgl_guest').removeClass('active')
          $('#img_bot').attr('src', 'static/kata.png')
          return {'val':'fast', 'ep':'/select-move/' }
        }
      } // if logged in
      else {
        fast_or_strong( 'guest') // Strong is disabled
        var tstr = '<a href="/login" class="touch-allow">' + translate('Please Log In') + '</a>'
        $('#donate_modal').html(tstr)
      }
    }
    else { // val == guest
      $('#descr_bot').html( `KataGo 10b &nbsp; 256<br>${DDATE}`)
      $('#btn_tgl_guest').addClass('active')
      $('#btn_tgl_fast').removeClass('active')
      $('#btn_tgl_strong').removeClass('active')
      $('#img_bot').attr('src', 'static/kata.png')
      return {'val':'guest', 'ep':'/select-move-guest/' }
    }
    return 0
  } // fast_or_strong()

  // Get a field from the user data, or fetch the user from the back end
  //-------------------------------------------------------------------------
  function user(key) {
    return user.data[key]
  } // user()
  user.data = {}

  // Translate a text into current language.
  //-------------------------------------------
  function translate(text) {
    if (!(user.data)) { return text }
    if (!(translate.table)) { return text }
    var tab = translate.table[user.data['lang']]
    if (!tab) { return text }
    if (!tab[text]) { return text }
    return tab[text]
  } // translate()
  translate.table = {}

  //------------------------------------------
  function server_sig_received( url, args) {
    if (url.indexOf('load_game') >= 0) {
      axutil.hit_endpoint_simple(
	'/watched', {}, // tell DB when we last saw the game
	(resp)=>{
	  axutil.hit_endpoint_simple( url, args, // actually get the game
				      (resp) => {
					if (url.indexOf('load_game') >= 0) {
					  grec.from_dict( resp)
					  replay_moves( grec.pos())
					}
				      })
	})
    } // if(load_game)
  } // server_sig_received()

  // Reload game from DB
  //--------------------------
  function reload_game() {
    grec.dbload( game_hash, ()=>{
      replay_moves( grec.pos())
      axutil.hit_endpoint_simple( '/watched', {}, (resp)=>{} )
    })
  } // reload_game()

  //--------------------------------
  function periodic_interrupt() {
    if (toggle_button( '#btn_tgl_live') == 'on') {
      axutil.hit_endpoint_simple( '/get_signal_url',{},
				  (resp) => {
				    if (resp.url) {
				      $('#status').html('>>> got server signal: ' + resp.url)
				      setTimeout( function() { $('#status').html('')},  500)
				      server_sig_received( resp.url, resp.args)
				    }
				  })
    }
    clearTimeout( periodic_interrupt.timer)
    periodic_interrupt.timer = setTimeout( periodic_interrupt, 2000)
  } // periodic_interrupt()
  periodic_interrupt.timer = null

  settings()
  toggle_button( '#btn_tgl_live', 'on')
  var grec = new GameRecord()
  // Load translation table and user data
  var serverData = new ServerData( axutil, ()=>{
    // Load the game we are observing
    grec.dbload( game_hash, ()=>{
      axutil.hit_endpoint_simple( '/watched', {}, (resp)=>{} )
      set_btn_handlers()
      setup_jgo()
      document.onkeydown = check_key
      replay_moves( grec.pos())
      periodic_interrupt()
    })
  })

  function tr( text) { return serverData.translate( text) }
} // function watch()
