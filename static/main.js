

/*
 * Main entry point for katago-gui
 * AHN Jan 2020
 */

'use strict'

const DEBUG = false
const VERSION = 'v1.55'
const KATAGO_SERVER = ''
const NIL_P = 0.0001

const HANDISTONES = ['',''
  ,['D4','Q16']
  ,['D4','Q16','Q4']
  ,['D4','Q16','Q4','D16']
  ,['D4','Q16','Q4','D16','K10']
  ,['D4','Q16','Q4','D16','D10','Q10']
  ,['D4','Q16','Q4','D16','D10','Q10','K10']
  ,['D4','Q16','Q4','D16','D10','Q10','K4','K16']
  ,['D4','Q16','Q4','D16','D10','Q10','K4','K16','K10']
]

//=======================================
function main( JGO, axutil, p_options) {
  $ = axutil.$

  const BOT = 'katago_gtp_bot'
  const BOARD_SIZE = 19
  const COLNAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T']

  var g_jrecord = new JGO.Record(BOARD_SIZE)
  var g_jsetup = new JGO.Setup(g_jrecord.jboard, JGO.BOARD.largeWalnut)
  //var g_player = null
  var g_ko = null // ko coordinate
  var g_last_move = null // last move coordinate
  var g_record = []
  var g_complete_record = []
  var g_play_btn_buffer = false // buffer one play btn click
  var g_click_coord_buffer = null // buffer one board click

  var g_komi = 7.5
  var g_handi = 0

  //================
  // UI Callbacks
  //================

  //-----------------------------------
  function set_dropdown_handlers() {
    $('#komi_menu').html(g_komi)
    $('#komi_m75').click( function() {  $('#komi_menu').html('-7.5') })
    $('#komi_m55').click( function() { $('#komi_menu').html('-5.5') })
    $('#komi_m35').click( function() { $('#komi_menu').html('-3.5') })
    $('#komi_m15').click( function() { $('#komi_menu').html('-1.5') })
    $('#komi_m05').click( function() { $('#komi_menu').html('-0.5') })
    $('#komi_05').click( function()  { $('#komi_menu').html('0.5') })
    $('#komi_15').click( function()  { $('#komi_menu').html('1.5') })
    $('#komi_35').click( function()  { $('#komi_menu').html('3.5') })
    $('#komi_55').click( function()  { $('#komi_menu').html('5.5') })
    $('#komi_75').click( function()  { $('#komi_menu').html('7.5') })

    $('#handi_menu').html(g_handi)
    $('#handi_0').click( function() { $('#handi_menu').html('0'); $('#komi_menu').html('7.5') })
    $('#handi_1').click( function() { $('#handi_menu').html('1'); $('#komi_menu').html('0.5') })
    $('#handi_2').click( function() { $('#handi_menu').html('2'); $('#komi_menu').html('0.5') })
    $('#handi_3').click( function() { $('#handi_menu').html('3'); $('#komi_menu').html('0.5') })
    $('#handi_4').click( function() { $('#handi_menu').html('4'); $('#komi_menu').html('0.5') })
    $('#handi_5').click( function() { $('#handi_menu').html('5'); $('#komi_menu').html('0.5') })
    $('#handi_6').click( function() { $('#handi_menu').html('6'); $('#komi_menu').html('0.5') })
    $('#handi_7').click( function() { $('#handi_menu').html('7'); $('#komi_menu').html('0.5') })
    $('#handi_8').click( function() { $('#handi_menu').html('8'); $('#komi_menu').html('0.5') })
    $('#handi_9').click( function() { $('#handi_menu').html('9'); $('#komi_menu').html('0.5') })

    $('#game_start_save').click( function() {
      g_handi = parseInt( $('#handi_menu').html())
      g_komi = parseFloat( $('#komi_menu').html())

      $('#lb_komi').html( 'Komi: ' + g_komi)
      reset_game();
      set_emoji();
      activate_bot( 'on')
      if (g_handi > 1) { botmove_if_active() }
      $('#status').html( '&nbsp;')
    })
  } // set_dropdown_handlers()

  // BLACK or WHITE depending on length of g_record
  //-------------------------------------------------
  function turn() {
    if (g_record.length % 2) {
      return JGO.WHITE
    }
    return JGO.BLACK
  } // turn()

  //----------------------------------------
  function board_click_callback( coord) {
    //SLOG(navigator.userAgent.toLowerCase())
		if (score_position.active) {
			goto_move( g_record.length)
			return
		}
		var jboard = g_jrecord.jboard
		if ((jboard.getType(coord) == JGO.BLACK) || (jboard.getType(coord) == JGO.WHITE)) { return }
    if (axutil.hit_endpoint('waiting')) {
      g_click_coord_buffer = coord
			return
		}
		// clear hover away
		hover()

		// Click on empty board resets everything
		if (g_record.length == 0) {
			reset_game()
		}

		// Add the new move
		maybe_start_var()
		var mstr = jcoord2string( coord)
		g_complete_record = g_record.slice()
		g_complete_record.push( {'mv':mstr, 'p':0.0, 'agent':'human'} )
		goto_move( g_complete_record.length)
		set_emoji()
		const playing = true
		get_prob_genmove( function() { botmove_if_active() }, settings('show_emoji'), playing )
  } // board_click_callback()

  // Black moves at the beginning are handicap
  //--------------------------------------------
  function get_handicap() {
    g_handi = 0
    var handi = 0
    for (var i=0; i < g_complete_record.length; i++) {
      if (i > 20) { break }
      if (i%2) { // white
        if (g_complete_record[i].mv != 'pass') {
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
		    canvas.addListener('click', function(coord, ev) { board_click_callback( coord) } );

		    //------------------------------
		    canvas.addListener('mousemove',
					function( coord, ev) {
					  var jboard = g_jrecord.jboard
					  if (coord.i == -1 || coord.j == -1)
					    return
					  if (coord == hover.coord)
					    return

            if (DEBUG && score_position.active) {
              var idx = jcoord2idx( coord)
              $('#status').html( score_position.probs[idx])
            }
            else {
					    hover( coord, turn())
              if (score_position.active) {
                draw_estimate( score_position.probs)
              }
            }
					}
				) // mousemove

		    //----------------------------
		    canvas.addListener('mouseout',
					function(ev) {
					  hover()
            if (score_position.active) {
              draw_estimate( score_position.probs)
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
    set_load_sgf_handler()
    var_button_state( 'off')

    $('#btn_clear_var').click( () => {
      if ($('#btn_clear_var').hasClass('disabled')) { return }
      handle_variation( 'clear')
    })

    $('#btn_play').click( () => {
      set_emoji()
      if (g_record.length == 0) {
        reset_game()
      }
      activate_bot( 'on')
      botmove_if_active()
      return false
    })

    // Autoplay slider
    $('#opt_auto').click( () => {
      var state = $('#opt_auto').prop('checked')
      if (state) { activate_bot('on') }
      else { activate_bot('off') }
    })

    $('#btn_best').click( () => {
      $('#status').html( 'Thinking...')
      get_best_move( (data) => {
        var botCoord = string2jcoord( data.bot_move)
        var jboard = g_jrecord.jboard
        if (botCoord != 'pass' && botCoord != 'resign') {
          blink( botCoord, turn(), 750, 3)
        }
        const show_emoji = false
			  const playing = false // true
			  get_prob_genmove( function() {}, show_emoji, playing )
      })
      return false
    })

    $('#btn_save').click( () => {
      var rec = moves_only(g_complete_record)
      var probs = probs_only(g_complete_record)
      var scores = scores_only(g_complete_record)
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
      if (score_position.active) {
			  goto_move( g_record.length)
			  return
		  }
      score_position()
      return false
    })

    $('#btn_pass').click( () => {
      g_complete_record = g_record.slice()
      g_complete_record.push( {'mv':'pass', 'p':NIL_P, 'agent':'human'} )
      goto_move( g_complete_record.length)
      botmove_if_active()
    })

    $('#btn_undo').click( () => {
      axutil.hit_endpoint('cancel')
      var len = g_record.length
      var at_end = (len == g_complete_record.length)
      if (len > 2 && g_record[len-1].agent == 'bot' && g_record[len-2].agent == 'human') {
	      goto_move( g_record.length - 2)
      } else {
	      goto_move( g_record.length - 1)
      }
      if (at_end) {
        g_complete_record = g_record
      }
      show_movenum()
    })

    $('#btn_prev').click( btn_prev)
    $('#btn_next').click( btn_next)
    $('#btn_back10').click( () => { goto_move( g_record.length - 10); update_emoji(); activate_bot('off') })
    $('#btn_fwd10').click( () => { goto_move( g_record.length + 10); update_emoji(); activate_bot('off') })
    $('#btn_first').click( () => { goto_first_move(); set_emoji(); activate_bot('off'); $('#status').html( '&nbsp;') })
    $('#btn_last').click( () => { goto_move( g_complete_record.length); update_emoji(); activate_bot('off') })

    // Prevent zoom on double tap
    $('*').on('touchend',(e)=>{
      //console.log('div')
      // Exceptions
      if (e.target.localName == 'canvas') { return }
      if (e.target.className.includes('btn-file')) { return }
      if (e.target.className.includes('btn-primary')) { return }
      if (e.target.className.includes('close')) { return }
      if (e.target.className.includes('dropdown')) { return }
      if (e.target.className.includes('slider round')) { return }
      // Nothing else reacts
      e.preventDefault()})
    // Links should still work
    $('a').on('touchend',(e)=>{
      console.log('a')
      e.preventDefault()
      e.target.click()})
    // Buttons should still work
    $('[id^=btn_]').on('touchstart',(e)=>{e.preventDefault();e.target.click()})
  } // set_btn_handlers()

  // Load Sgf button
  //-----------------------------------
  function set_load_sgf_handler() {
    $('#sgf-file').on('change', function() {
      var input = $(this)
      var myfile = input.get(0).files[0]
      var numFiles = input.get(0).files ? input.get(0).files.length : 1
      var label = input.val().replace(/\\/g, '/').replace(/.*\//, '')
      handle_variation( 'clear')
      // Call API to get the moves, then replay on the board
      axutil.upload_file( '/sgf2list', myfile, (response) => {
        var res = response.result
        var moves = res.moves
        $('#lb_komi').html( 'Komi: ' + res.komi)
        set_emoji()
        replay_move_list( moves)
	      if ('probs' in res) {
	        var probs = res.probs
	        for (var i=0; i < moves.length; i++) {
	          g_record[i].p = parseFloat( probs[i])
	        }
	      }
	      if ('scores' in res) {
	        var scores = res.scores
	        for (var i=0; i < moves.length; i++) {
	          g_record[i].score = parseFloat( scores[i])
	        }
	      }
        g_complete_record = g_record.slice()
        show_movenum()
        g_komi = res.komi
        get_handicap()
        show_game_info( res)
        $('#status').html('')
        set_load_sgf_handler.loaded_game = res
        $('#sgf-file').val('') // reset to make sure it triggers again
      })
    }) // $('sgf-file')
  } // set_load_sgf_handler()

  //-----------------------------------------
  function show_game_info( loaded_game) {
    if (loaded_game) {
      $('#game_info').html(
        `B:${loaded_game.pb} &nbsp;&nbsp; W:${loaded_game.pw} &nbsp;&nbsp; Result:${loaded_game.RE} &nbsp;&nbsp; Date:${loaded_game.DT}`)
      $('#fname').html( loaded_game.fname)
    } else {
      $('#game_info').html('')
      $('#fname').html('')
    }
  } // show_game_info()

  //-------------------------
  function btn_prev() {
    goto_move( g_record.length - 1); update_emoji(); activate_bot('off')
  }

  //-------------------------
  function btn_next() {
    if (btn_next.waiting) { btn_next.buffered = true; btn_next.waiting = false; return }
    goto_move( g_record.length + 1)
    if (g_record.length < 20  && g_record[ g_record.length - 1].mv == 'pass') {
      goto_move( g_record.length + 1)
    }
    if (g_record[ g_record.length - 1].p == 0) {
      btn_next.waiting = true
      get_prob_genmove( (data) => {
        update_emoji()
        activate_bot('off')
        btn_next.waiting = false
        if (btn_next.buffered) {
          btn_next.buffered = false
          btn_next()
        }
      })
      return
    }
    update_emoji()
    activate_bot('off')
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
    else if (check_key.ctrl_pressed && e.keyCode == '82') {  // ctrl-r
      $('#status').html( VERSION)
    }
    else if (check_key.ctrl_pressed && e.keyCode == '65') {  // ctrl-a accept var
      handle_variation( 'accept')
    }
    else if (e.keyCode == '38') { // up arrow
    }
    else if (e.keyCode == '40') { // down arrow
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

  //---------------------------
  function log_event( bot) {
    if (handle_variation.var_backup) {
      gtag('event', 'play', { 'event_category': bot + '_a', 'event_label': 'label', 'value':1} );
    }
    else {
      gtag('event', 'play', { 'event_category': bot + '_p', 'event_label': 'label', 'value':1} );
    }
  } // log_event()

  //-----------------------------
  function get_katago_move() {
    log_event( 'katago')
    $('#status').html( 'KataGo is thinking...')
    var randomness = 0.0
    get_bot_move( g_handi, g_komi, 0)
  } // get_katago_move()

  //--------------------------------
  function botmove_if_active() {
    if (axutil.hit_endpoint('waiting')) {
      g_play_btn_buffer = true; return true
    }
    if (activate_bot.state == 'off') { return true }
    get_katago_move()
    return true
  } // botmove_if_active()

  // Get next move from the bot and show on board
  //----------------------------------------------------
  function get_bot_move( handicap, komi, playouts) {
    axutil.hit_endpoint( KATAGO_SERVER + '/select-move/' + BOT, {'board_size': BOARD_SIZE, 'moves': moves_only(g_record),
			'config':{'komi':komi, 'playouts':playouts } },
			(data) => {
			  hover() // The board thinks the hover stone is actually there. Clear it.
			  var botprob = data.diagnostics.winprob; var botcol = 'Black'
			  if (turn() == JGO.WHITE) { botprob = 1.0 - botprob; botcol = 'White' }

			  if (data.bot_move == 'pass') {
			    alert( 'Katago passes. Click on the Score button.')
			  }
			  else if (data.bot_move == 'resign') {
			    alert( 'Katago resigns.')
			    $('#status').html( botcol + ' resigned')
          return
			  }
			  else if ( (!handle_variation.var_backup) && (g_record.length > 150) && ( // do not resign in variation or too early
          (g_handi < 3 && botprob < 0.01) ||
          (g_handi < 2 && botprob < 0.02) ||
          (botprob < 0.001))
        )
        {
			    alert( 'Katago resigns. You beat Katago!')
			    $('#status').html( botcol + ' resigned')
          return
			  }
			  else {
			    maybe_start_var()
			    var botCoord = string2jcoord( data.bot_move)
			  }
			  show_move( turn(), botCoord, 0.0, 'bot')
			  g_complete_record = g_record.slice()
			  replay_move_list( g_record)
			  show_movenum()
			  const show_emoji = false
			  const playing = true
        get_prob_callback( data.diagnostics.winprob, data.diagnostics.score, show_emoji, playing)
			})
  } // get_bot_move()

  //-----------------------------------
  function activate_bot( on_or_off) {
    activate_bot.state = on_or_off
    if (on_or_off == 'on') {
      $('#opt_auto').prop('checked', true)
      $('#btn_play').css('border-width', '1px')
      $('#btn_play').css('border-color', '#FF0000')
    }
    else {
      axutil.hit_endpoint('cancel')
      $('#opt_auto').prop('checked', false)
      $('#btn_play').css('border-width', '1px')
      $('#btn_play').css('border-color', '#343A40')
    }
  } // activate_bot()
  activate_bot.state = 'off'

  //========
  // Moves
  //========

  // Show a move on the board and append it to g_record
  //------------------------------------------------------
  function show_move(player, coord, prob, score, agent) {
    if (coord == 'pass' || coord == 'resign') {
      g_ko = false
      g_record.push( { 'mv':coord, 'p':prob, 'score':score, 'agent':agent } )
      return
    }
    var play = g_jrecord.jboard.playMove( coord, player, g_ko)
    if (play.success) {
      g_record.push( { 'mv':jcoord2string( coord), 'p':prob, 'score':score, 'agent':agent } )
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
    else {
      var tstr = player + coord
      var node = g_jrecord.getCurrentNode()
      node.setMark( coord, JGO.MARK.SQUARE)
      alert( 'Illegal move: ' + play.errorMsg + ' ' + tstr)
    }
  } // show_move()

  //------------------------
  function goto_first_move() {
    //g_player = JGO.BLACK
    g_ko = false
    g_last_move = false
    g_record = []
    g_jrecord.jboard.clear()
    g_jrecord.root = g_jrecord.current = null
    show_movenum()
  } // goto_first_move()

  //-----------------------
  function reset_game() {
    handle_variation( 'clear')
    set_load_sgf_handler.loaded_game = null
    show_game_info( set_load_sgf_handler.loaded_game)
    g_complete_record = []
    g_record = []
    goto_first_move()
    if (g_handi < 2) { return }
    var hstones =  HANDISTONES[g_handi]
    for (const [idx,s] of hstones.entries()) {
      if (idx > 0) {
        g_complete_record.push( {'mv':'pass', 'p':NIL_P, 'agent':''} )
      }
      g_complete_record.push( {'mv':s, 'p':NIL_P, 'agent':''} )
    }
    goto_move(1000)
  } // reset_game()

  // Replay game from empty board.
  //------------------------------------
  function replay_move_list( mlist) {
    var jboard = g_jrecord.jboard
    goto_first_move()
    for (var move_prob of mlist) {
      if (typeof move_prob == 'string') { // pass or resign
        move_prob = { 'mv':move_prob, 'p':NIL_P, 'agent':'' }
      }
      var move_string = move_prob.mv
      var coord = string2jcoord( move_string)
      show_move( turn(), coord, move_prob.p, move_prob.score, move_prob.agent)
    }
    show_movenum()
  } // replay_move_list()

  // Replay and show game up to move n
  //-------------------------------------
  function goto_move( n) {
    score_position.active = false
    var totmoves = g_complete_record.length
    if (n > totmoves) { n = totmoves }
    if (n < 1) { goto_first_move(); set_emoji(); return }
    var record = g_complete_record.slice( 0, n)
    replay_move_list( record)
    show_movenum()
    show_prob()
    //update_emoji()
  } // goto_move()

  //----------------------------
  function show_movenum() {
    if (!g_complete_record) { return }
    var totmoves = g_complete_record.length
    var n = g_record.length
    $('#movenum').html( `${n} / ${totmoves}`)
  } // show_movenum()

  //======================
  // Variation handling
  //======================

  // Make a variation, or restore from var, or forget var
  //--------------------------------------------------------
  function handle_variation( action) {
    if (action == 'save') { // Save record and start a variation
      handle_variation.var_backup = JSON.parse( JSON.stringify( g_complete_record))
      handle_variation.var_pos = g_record.length + 1
      var_button_state('on')
    }
    else if (action == 'clear') { // Restore game record and forget the variation
      if (handle_variation.var_backup) {
        g_complete_record = JSON.parse( JSON.stringify( handle_variation.var_backup))
        g_record = g_complete_record.slice( 0, handle_variation.var_pos)
	      // If there is only one more move, forget it.
	      if (g_record.length + 1 == g_complete_record.length) {
	        g_complete_record.pop()
	      }
        goto_move( g_record.length)
        update_emoji(); activate_bot('off')
        handle_variation.var_backup = null
        var_button_state('off')
        $('#status').html( 'Variation deleted')
      }
    }
    else if (action == 'accept') { // Forget saved game record and replace it with the variation
      if (var_button_state() == 'off') { return }
      handle_variation.var_backup = null
      g_complete_record = g_record
      var_button_state( 'off')
      $('#status').html( 'Variation accepted')
    }
  } // handle_variation()
  handle_variation.var_backup = null
  handle_variation.var_pos = 0

  // Start a variation if we're not at the end
  //---------------------------------------------
  function maybe_start_var() {
    if (g_complete_record && g_record.length < g_complete_record.length) {
      if (!handle_variation.var_backup) { // we are not in a variation, make one
        handle_variation( 'save')
      }
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
      /* $('#btn_accept_var').removeClass('disabled')
       * $('#btn_accept_var').addClass('btn-danger') */
      $('#btn_clear_var').css('color', 'black')
      /* $('#btn_accept_var').css('color', 'black'); */
      //$('#btn_clear_var').css('visibility', 'visible');
    }
    else {
      $('#btn_clear_var').addClass('disabled')
      $('#btn_clear_var').removeClass('btn-success')
      /* $('#btn_accept_var').addClass('disabled')
       * $('#btn_accept_var').removeClass('btn-danger') */
      $('#btn_clear_var').css('color', 'black')
      /* $('#btn_accept_var').css('color', 'black'); */
      //$('#btn_clear_var').css('visibility', 'hidden');
    }
  } // var_button_state()

  //===============================
  // Saving and restoring state
  //===============================

  //--------------------------
  function save_state() {
    if (var_button_state() == 'off') { // don't save if in variation
      localStorage.setItem('record', JSON.stringify( g_record))
      localStorage.setItem('complete_record', JSON.stringify( g_complete_record))
      localStorage.setItem('komi', JSON.stringify( g_komi))
      localStorage.setItem('bot_active', activate_bot.state)
      localStorage.setItem('loaded_game', JSON.stringify( set_load_sgf_handler.loaded_game))
    }
  } // save_state()

  //--------------------------
  function load_state() {
    /* var bot = localStorage.getItem('bot')
     * if (BOTS.indexOf( bot) < 0) { bot = BOTS[0] }
     * change_bot(bot) */
    if (localStorage.getItem('record') === null) { return }
    if (localStorage.getItem('complete_record') === null) { return }
    if (localStorage.getItem('record') === 'null') { return }
    if (localStorage.getItem('complete_record') === 'null') { return }
    set_load_sgf_handler.loaded_game = JSON.parse( localStorage.getItem( 'loaded_game'))
    show_game_info( set_load_sgf_handler.loaded_game)
    g_record = JSON.parse( localStorage.getItem('record'))
    g_complete_record = JSON.parse( localStorage.getItem('complete_record'))
    g_komi = JSON.parse( localStorage.getItem('komi'))
    activate_bot.state = localStorage.getItem('bot_active')
    $('#lb_komi').html( 'Komi: ' + g_komi)
    goto_move( g_record.length)
  }

  //======================
  // Winning probability
  //======================

  // Get current winning probability from genmove
  //-------------------------------------------------------------
  function get_prob_genmove( completion, update_emo, playing) {
    if (activate_bot.state == 'on') {
      $('#status').html( 'KataGo is counting...')
    }
    else {
      $('#status').html( '...')
    }
    axutil.hit_endpoint( KATAGO_SERVER + '/select-move/' + BOT,
			{'board_size': BOARD_SIZE, 'moves': moves_only(g_record), 'config':{'komi': g_komi } },
			(data) => {
        get_prob_callback( data.diagnostics.winprob, data.diagnostics.score, update_emo, playing)
			  if (completion) { completion(data) }
			})
  } // get_prob_genmove()

  // Continue after prob and score came back from the server
  //-------------------------------------------------------------------
  function get_prob_callback( winprob, score, update_emo, playing) {
		if (g_record.length) {
			var p = parseFloat(winprob)
			g_record[ g_record.length - 1].p = p // Remember win prob of position
			g_complete_record[ g_record.length - 1].p = p
			var score = parseFloat(score)
			g_record[ g_record.length - 1].score = score // Remember score of position
			g_complete_record[ g_record.length - 1].score = score
		}
		show_prob( update_emo, playing)
    if (g_play_btn_buffer) { // Buffered play button click
      botmove_if_active()
    }
    if (g_click_coord_buffer) { // user clicked while waiting, do it now
      board_click_callback( g_click_coord_buffer)
    }
    g_play_btn_buffer = false
    g_click_coord_buffer = null
  } // get_prob_callback()

  // Get the best move
  //----------------------------------------------------------
  function get_best_move( completion, update_emo, playing) {
    $('#status').html( 'KataGo is thinking...')
    axutil.hit_endpoint( KATAGO_SERVER + '/select-move/' + BOT,
			{'board_size': BOARD_SIZE, 'moves': moves_only(g_record), 'config':{'komi': g_komi } },
			(data) => {
			  if (completion) { completion(data) }
        $('#status').html( '')
			})
  } // get_best_move()

  //------------------------------------------
  function show_prob( update_emo, playing) {
    var n = g_record.length - 1
    if (n >= 0) {
      var p = g_record[n].p
      var score = g_record[n].score
      // 0.8 -> 1.0; 1.3 -> 1.5 etc
      score = Math.trunc( Math.abs(score) * 2 + 0.5) * Math.sign(score) / 2.0
      if (p == 0) {
        set_emoji(); $('#status').html('')
        return
      }
      if (playing && !settings('show_prob')) {
        $('#status').html('')
      } else {
        var scorestr = '&nbsp;&nbsp;B+'
        if (score < 0) {
          scorestr = '&nbsp;&nbsp;W+'
        }
        scorestr += Math.abs(score)
        var tstr = 'P(B wins): ' + p.toFixed(2)
        if (g_record[n].score) {
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
    var n = g_record.length - 1
    if (n < 0) { return }
    var p = g_record[n].p
    var score = g_record[n].score
    if (p == 0) { set_emoji(); return }
    if (n > 0) {
      if (g_record[n].mv == 'pass') {  set_emoji(); return }
      if (g_record[n-1].mv == 'pass') {  set_emoji(); return }
      if (g_record[n-1].p == NIL_P) {  set_emoji(); return }
      var pp = g_record[n-1].p
      var pscore = g_record[n-1].score
      if (n % 2) { // we are white
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
    const SCORE_BINS = [3, 5, 10]
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
    axutil.hit_endpoint( KATAGO_SERVER + '/score/' + BOT,
      {'board_size': BOARD_SIZE, 'moves': moves_only(g_record), 'config':{'komi':g_komi }, 'tt':Math.random() },
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
        replay_move_list( g_record) // remove artifacts
        jboard.setType( coord, hcol == JGO.WHITE ? JGO.DIM_WHITE : JGO.DIM_BLACK)
      }
    }
    else if (hover.coord) {
      jboard.setType( hover.coord, JGO.CLEAR)
      hover.coord = null
      replay_move_list( g_record) // remove artifacts
    }
  } // hover()
  hover.coord = null

  // Get a value from the settings screen via localStorage
  //--------------------------------------------------------
  function settings( key, value) {
    const settings_defaults = { show_emoji:true, show_prob:true }
    var settings = JSON.parse( localStorage.getItem( 'settings'))
    if (!settings) {
      localStorage.setItem( 'settings', JSON.stringify( settings_defaults))
      settings = JSON.parse( localStorage.getItem( 'settings'))
    }
    // init
    if (typeof key == 'undefined') { return }
    // getter
    else if (typeof value == 'undefined') {
      var res = settings[key] || ''
      return res
    }
    // setter
    else {
      settings[key] = value
      localStorage.setItem( 'settings', JSON.stringify( settings))
    }
  } // settings()

  $('#version').html(VERSION + (p_options.mobile?'&nbsp;&nbsp;':''))
  settings()
  set_btn_handlers()
  set_dropdown_handlers()
  reset_game()
  setup_jgo()
  load_state()
  document.onkeydown = check_key

  if (p_options.mobile) {
    window.onpagehide = save_state
  }
  else {
    window.onbeforeunload = save_state
  }

  // Save game record once a second
  function statesaver() {
    save_state()
    setTimeout(statesaver, 1000)
  }
  statesaver()

} // function main()
