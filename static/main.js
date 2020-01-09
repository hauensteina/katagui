
/*
 * Main entry point for web_gui Go board
 * AHN Apr 2019
 */

'use strict'

const DEBUG = false
const VERSION = '2020-01-09'
const KATAGO_SERVER = ''
//const BOTS = ['fry', 'bender', 'farnsworth', 'katago']

//=======================================
function main( JGO, axutil, p_options) {
  $ = axutil.$

  const BOT = 'katago_gtp_bot'
  const BOARD_SIZE = 19
  const COLNAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T']

  var g_jrecord = new JGO.Record(BOARD_SIZE)
  var g_jsetup = new JGO.Setup(g_jrecord.jboard, JGO.BOARD.largeWalnut)
  var g_player = null
  var g_ko = null // ko coordinate
  var g_last_move = null // last move coordinate
  var g_record = []
  var g_complete_record = []
  var g_play_btn_buffer = false // buffer one play btn click
  var g_click_coord_buffer = null // buffer one board click

  var g_komi = -7.5
  var g_handi = 0

  //$('#opt_auto').prop('checked', true)

  //================
  // UI Callbacks
  //================

  //-----------------------------------
  function set_dropdown_handlers() {
    $('#komi_menu').html(g_komi)
    $('#komi_m75').click( function() { g_komi = -7.5; $('#komi_menu').html('-7.5') })
    $('#komi_m55').click( function() { g_komi = -5.5; $('#komi_menu').html('-5.5') })
    $('#komi_m35').click( function() { g_komi = -3.5; $('#komi_menu').html('-3.5') })
    $('#komi_m15').click( function() { g_komi = -1.5; $('#komi_menu').html('-1.5') })
    $('#komi_m05').click( function() { g_komi = -0.5; $('#komi_menu').html('-0.5') })
    $('#komi_05').click( function()  { g_komi = 0.5;  $('#komi_menu').html('0.5') })
    $('#komi_15').click( function()  { g_komi = 1.5;  $('#komi_menu').html('1.5') })
    $('#komi_35').click( function()  { g_komi = 3.5;  $('#komi_menu').html('3.5') })
    $('#komi_55').click( function()  { g_komi = 5.5;  $('#komi_menu').html('5.5') })
    $('#komi_75').click( function()  { g_komi = 7.5;  $('#komi_menu').html('7.5') })

    $('#handi_menu').html(g_handi)
    $('#handi_0').click( function() { g_handi = 0; $('#handi_menu').html('0'); g_komi = 7.5;  $('#komi_menu').html('7.5') })
    $('#handi_1').click( function() { g_handi = 1; $('#handi_menu').html('1'); g_komi = 0.5;  $('#komi_menu').html('0.5') })
    $('#handi_2').click( function() { g_handi = 2; $('#handi_menu').html('2'); g_komi = 0.5;  $('#komi_menu').html('0.5') })
    $('#handi_3').click( function() { g_handi = 3; $('#handi_menu').html('3'); g_komi = 0.5;  $('#komi_menu').html('0.5') })
    $('#handi_4').click( function() { g_handi = 4; $('#handi_menu').html('4'); g_komi = 0.5;  $('#komi_menu').html('0.5') })
    $('#handi_5').click( function() { g_handi = 5; $('#handi_menu').html('5'); g_komi = 0.5;  $('#komi_menu').html('0.5') })
    $('#handi_6').click( function() { g_handi = 6; $('#handi_menu').html('6'); g_komi = 0.5;  $('#komi_menu').html('0.5') })
    $('#handi_7').click( function() { g_handi = 7; $('#handi_menu').html('7'); g_komi = 0.5;  $('#komi_menu').html('0.5') })
    $('#handi_8').click( function() { g_handi = 8; $('#handi_menu').html('8'); g_komi = 0.5;  $('#komi_menu').html('0.5') })
    $('#handi_9').click( function() { g_handi = 9; $('#handi_menu').html('9'); g_komi = 0.5;  $('#komi_menu').html('0.5') })
  } // set_dropdown_handlers()

  //----------------------------------------
  function board_click_callback( coord) {
		if (score_position.active) {
			goto_move( g_record.length)
			score_position.active = false
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
		get_prob( function() { botmove_if_active() }, settings('show_emoji'), playing )
  } // board_click_callback()

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
              $('#status').html( score_position.white_probs[idx])
            }
            else {
					    hover( coord, g_player)
            }
					}
				) // mousemove

		    //----------------------------
		    canvas.addListener('mouseout',
					function(ev) {
					  hover()
					}
				) // mouseout
		  } // function(canvas)
		) // create board
  } // setup_jgo()

  // Set button callbacks
  //------------------------------
  function set_btn_handlers() {
    set_load_sgf_handler()
    var_button_state( 'off')

    //$('#btn_change').click( () => { change_bot() })

    $('#btn_clear_var').click( () => {
      if ($('#btn_clear_var').hasClass('disabled')) { return }
      handle_variation( 'clear')
    })

    $('#btn_accept_var').click( () => {
      if ($('#btn_accept_var').hasClass('disabled')) { return }
      handle_variation( 'accept')
    })

    $('#btn_play').click( () => {
      set_emoji()
      if (g_record.length == 0) {
        reset_game()
      }
      $('#histo').hide()
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
      $('#histo').hide()
      $('#status').html( 'thinking...')
      get_prob( (data) => {
        var botCoord = string2jcoord( data.bot_move)
        var jboard = g_jrecord.jboard
        if (botCoord != 'pass' && botCoord != 'resign') {
          hover( botCoord, g_player, {force:true})
          setTimeout( () => { hover() }, 1000)
        }
      })
      return false
    })

    $('#btn_save').click( () => {
      var rec = moves_only(g_complete_record)
      var probs = probs_only(g_complete_record)
      for (var i=0; i < probs.length; i++) { probs[i] = probs[i].toFixed(2) }
      // Kludge to manage passes
      for (var i=0; i < rec.length; i++) {
        if (rec[i] == 'pass') { rec[i] = 'A0' }
      }
      var moves = rec.join('')
      probs = probs.join(',')
      if (moves.length == 0) { return }
      var url = '/save-sgf?q=' + Math.random() + '&moves=' + moves + '&probs=' + probs
      window.location.href = url
    })

    $('#btn_nnscore').click( () => {
      score_position( 'nnscore')
      //$('#histo').show()
      return false
    })

    $('#btn_pass').click( () => {
      g_complete_record = g_record.slice()
      g_complete_record.push( {'mv':'pass', 'p':0.0, 'agent':'human'} )
      goto_move( g_complete_record.length)
      botmove_if_active()
    })

    $('#btn_undo').click( () => {
      $('#histo').hide()
      axutil.hit_endpoint('cancel')
      var len = g_record.length
      if (len > 2 && g_record[len-1].agent == 'bot' && g_record[len-2].agent == 'human') {
	      goto_move( g_record.length - 2)
      } else {
	      goto_move( g_record.length - 1)
      }
      if (activate_bot.state == 'on') {
        g_complete_record = g_record
      }
      show_movenum()
    })

    $('#btn_prev').click( btn_prev)
    $('#btn_next').click( btn_next)
    $('#btn_back10').click( () => { $('#histo').hide(); goto_move( g_record.length - 10); update_emoji(); activate_bot('off') })
    $('#btn_fwd10').click( () => { $('#histo').hide(); goto_move( g_record.length + 10); update_emoji(); activate_bot('off') })
    $('#btn_first').click( () => { $('#histo').hide(); goto_first_move(); set_emoji(); activate_bot('off'); $('#status').html( '&nbsp;') })
    $('#btn_last').click( () => { $('#histo').hide(); goto_move( g_complete_record.length); update_emoji(); activate_bot('off') })
    $('#btn_new').click( () => { $('#histo').hide(); reset_game(); set_emoji(); activate_bot('off'); $('#status').html( '&nbsp;') })

    // Prevent zoom on double tap
    $('#btn_change').on('touchstart', prevent_zoom)
    $('#btn_play').on('touchstart', prevent_zoom)
    $('#btn_undo').on('touchstart', prevent_zoom)
    $('#btn_best').on('touchstart', prevent_zoom)
    $('#btn_pass').on('touchstart', prevent_zoom)
    $('#btn_prev').on('touchstart', prevent_zoom)
    $('#btn_next').on('touchstart', prevent_zoom)
    $('#btn_clear_var').on('touchstart', prevent_zoom)
    $('#btn_accept_var').on('touchstart', prevent_zoom)
    $('#btn_first').on('touchstart', prevent_zoom)
    $('#btn_back10').on('touchstart', prevent_zoom)
    $('#btn_fwd10').on('touchstart', prevent_zoom)
    $('#btn_last').on('touchstart', prevent_zoom)
    $('#btn_nnscore').on('touchstart', prevent_zoom)
    $('#btn_save').on('touchstart', prevent_zoom)
    $('#btn_new').on('touchstart', prevent_zoom)
  } // set_btn_handlers()

  // Load Sgf button
  //-----------------------------------
  function set_load_sgf_handler() {
    $('#sgf-file').on('change', function() {
      var input = $(this)
      var myfile = input.get(0).files[0]
      var numFiles = input.get(0).files ? input.get(0).files.length : 1
      var label = input.val().replace(/\\/g, '/').replace(/.*\//, '')
      // Call API to get the moves, then replay on the board
      axutil.upload_file( '/sgf2list', myfile, (response) => {
        var res = response.result
        var moves = res.moves
        set_emoji()
        replay_move_list( moves)
	      if ('probs' in res) {
	        var probs = res.probs
	        for (var i=0; i < moves.length; i++) {
	          g_record[i].p = parseFloat( probs[i])
	        }
	      }
        g_complete_record = g_record.slice()
        show_movenum()
        var komi = res.komi
        // Game Info
        $('#game_info').html( `B:${res.pb} &nbsp;&nbsp; W:${res.pw} &nbsp;&nbsp; Result:${res.RE} &nbsp;&nbsp; Komi:${komi}`)
        $('#fname').html( res.fname)
      })
    }) // $('sgf-file')
  } // set_load_sgf_handler()

  //-------------------------
  function btn_prev() {
    $('#histo').hide(); goto_move( g_record.length - 1); update_emoji(); activate_bot('off')
  }
  //-------------------------
  function btn_next() {
    if (btn_next.waiting) { btn_next.buffered = true; return }
    $('#histo').hide()
    goto_move( g_record.length + 1)
    if (g_record[ g_record.length - 1].p == 0) {
      btn_next.waiting = true
      get_prob( (data) => {
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

  // Prevent double taps from zooming in on mobile devices.
  // Use like btn.addEventListener('touchstart', prevent_zoom)
  //------------------------------------------------------------
  function prevent_zoom(e) {
    //var t2 = e.timeStamp
    //var t1 = e.currentTarget.dataset.lastTouch || t2
    //var dt = t2 - t1
    //var fingers = e.touches.length
    //e.currentTarget.dataset.lastTouch = t2
    //if (!dt || dt > 500 || fingers > 1) return
    e.preventDefault()
    e.target.click()
  } // prevent_zoom()

  //===================
  // Bot Interaction
  //===================

  // Switch to the given bot. If called without bot, go to the next bot.
  //----------------------------------------------------------------------
  /* function change_bot( bot) {
   *   const bots = BOTS

   *   const images = ['static/fry.png', 'static/bender.png', 'static/farnsworth.png', 'static/katago.png']
   *   const names = ['Fry', 'Bender', 'Prof. Farnsworth', 'Katago']
   *   const strengths = ['Oh well', 'Not bad', '6D', '9P']

   *   var idx = 0
   *   if (typeof bot == 'undefined') {
   *     idx = bots.indexOf( change_bot.botname)
   *     idx++; idx %= bots.length
   *   }
   *   else {
   *     idx = bots.indexOf( bot)
   *   }
   *   change_bot.botname = bots[idx]
   *   $('#descr_bot').html( names[idx] + '<br> Strength: ' + strengths[idx] + '<br>')
   *   $('#img_bot').attr( 'src', images[idx])
   *   activate_bot('off')
   * } // change_bot()
   * change_bot.botname = 'fry'

   * const OPENING_RANDOMNESS = 0.33
   * const ENDGAME_RANDOMNESS = 0
   * const FARNSWORTH_RANDOMNESS = 0 // 6D
   * const FARNSWORTH_PLAYOUTS = 32
   * const BENDER_RANDOMNESS = 0 // 0.15
   * const BENDER_PLAYOUTS = 1
   * const FRY_RANDOMNESS = 0.15 // 0.12 // 0.13 // kyu
   */

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
    $('#status').html( 'Katago is thinking...')
    var randomness = 0.0
    if (g_record.length < g_complete_record.length || handle_variation.var_backup) { randomness = -1.0 } // No randomness if analyzing
    get_bot_move( randomness, 0)
  } // get_katago_move()

  //-----------------------------
  function get_farnsworth_move() {
    log_event( 'farnsworth')
    $('#status').html( 'Farnsworth is guessing... ')
    get_bot_move( FARNSWORTH_RANDOMNESS, FARNSWORTH_PLAYOUTS)
  } // get_farnsworth_move()

  //-----------------------------
  function get_bender_move() {
    log_event( 'bender')
    $('#status').html( 'Bender is trying...')
    if (g_record.length < 15) {
      get_bot_move( OPENING_RANDOMNESS)
    }
    else {
      get_bot_move( BENDER_RANDOMNESS, BENDER_PLAYOUTS)
    }
  } // get_bender_move()

  //-----------------------------
  function get_fry_move() {
    log_event( 'fry')
    $('#status').html( 'Fry is struggling...')
    if (g_record.length < 15) {
      get_bot_move( OPENING_RANDOMNESS)
    }
    else if (g_record.length < 140) {
      get_bot_move( FRY_RANDOMNESS)
    }
    else {
      get_bot_move( ENDGAME_RANDOMNESS, 1)
    }
  } // get_fry_move()

  //--------------------------------
  function botmove_if_active() {
    if (axutil.hit_endpoint('waiting')) { g_play_btn_buffer = true; return true }
    if (activate_bot.state == 'off') { return true }
    get_katago_move()
    return true
  } // botmove_if_active()

  // Get next move from the bot and show on board
  //-------------------------------------------------
  function get_bot_move( randomness, playouts) {
    var handi = 1 + g_record.slice(0,17).filter( function(x) { return x.mv == 'pass'}).length
    randomness = randomness || 0.0
    playouts = playouts || 0.0
    axutil.hit_endpoint( KATAGO_SERVER + '/select-move/' + BOT, {'board_size': BOARD_SIZE, 'moves': moves_only(g_record),
			'config':{'randomness': randomness, 'playouts':playouts } },
			(data) => {
			  hover() // The board thinks the hover stone is actually there. Clear it.

			  var botprob = data.diagnostics.winprob; var botcol = 'Black'
			  if (g_player == JGO.WHITE) { botprob = 1.0 - botprob; botcol = 'White' }

			  if (data.bot_move == 'pass') {
			    alert( 'The bot passes. Click on the Score button.')
			  }
			  else if (data.bot_move == 'resign') {
			    alert( 'The bot resigns.')
			    $('#status').html( botcol + ' resigned')
          return
			  }
			  else if ( (!handle_variation.var_backup) && (g_record.length > 100) && ( // do not resign in variation or too early
          (handi < 3 && botprob < 0.01) ||
          (handi < 2 && botprob < 0.02) ||
          (botprob < 0.001))
        )
        {
			    alert( 'The bot resigns. You beat the bot!')
			    $('#status').html( botcol + ' resigned')
          return
			  }
			  else {
			    maybe_start_var()
			    var botCoord = string2jcoord( data.bot_move)
			  }
			  show_move( g_player, botCoord, 0.0, 'bot')
			  g_complete_record = g_record.slice()
			  replay_move_list( g_record)
			  show_movenum()
			  g_player =  (g_player == JGO.BLACK) ? JGO.WHITE : JGO.BLACK
			  const show_emoji = false
			  const playing = true
			  get_prob( function() {}, show_emoji, playing )
			})
  } // get_bot_move()

  //-----------------------------------
  function activate_bot( on_or_off) {
    activate_bot.state = on_or_off
    if (on_or_off == 'on') {
      $('#opt_auto').prop('checked', true)
      $('#btn_play').css('border-width', '3px')
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
  function show_move(player, coord, prob, agent) {
    if (coord == 'pass' || coord == 'resign') {
      g_ko = false
      g_record.push( { 'mv':coord, 'p':prob, 'agent':agent } )
      return
    }
    var play = g_jrecord.jboard.playMove( coord, player, g_ko)
    if (play.success) {
      g_record.push( { 'mv':jcoord2string( coord), 'p':prob, 'agent':agent } )
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
    g_player = JGO.BLACK
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
    //set_emoji()
    g_complete_record = []
    g_record = []
    goto_first_move()
  } // reset_game()

  // Replay game from empty board.
  //------------------------------------
  function replay_move_list( mlist) {
    var jboard = g_jrecord.jboard
    goto_first_move()
    for (var move_prob of mlist) {
      if (typeof move_prob == 'string') { // pass or resign
        move_prob = { 'mv':move_prob, 'p':0.0, 'agent':'' }
      }
      var move_string = move_prob.mv
      var coord = string2jcoord( move_string)
      show_move( g_player, coord, move_prob.p, move_prob.agent)
      g_player =  (g_player == JGO.BLACK) ? JGO.WHITE : JGO.BLACK
    }
    hover( hover.coord) // restore hover
    show_movenum()
  } // replay_move_list()

  // Replay and show game up to move n
  //-------------------------------------
  function goto_move( n) {
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
      $('#btn_accept_var').removeClass('disabled')
      $('#btn_accept_var').addClass('btn-danger')
      $('#btn_clear_var').css('color', 'black');
      $('#btn_accept_var').css('color', 'black');
    }
    else {
      $('#btn_clear_var').addClass('disabled')
      $('#btn_clear_var').removeClass('btn-success')
      $('#btn_accept_var').addClass('disabled')
      $('#btn_accept_var').removeClass('btn-danger')
      $('#btn_clear_var').css('color', 'black');
      $('#btn_accept_var').css('color', 'black');
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
      //localStorage.setItem('bot', change_bot.botname)
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
    g_record = JSON.parse( localStorage.getItem('record'))
    g_complete_record = JSON.parse( localStorage.getItem('complete_record'))
    goto_move( g_record.length)
  }

  //======================
  // Winning probability
  //======================

  // Get current winning probability.
  //-----------------------------------------------------
  function get_prob( completion, update_emo, playing) {
    axutil.hit_endpoint( KATAGO_SERVER + '/select-move/' + BOT,
			{'board_size': BOARD_SIZE, 'moves': moves_only(g_record), 'config':{'randomness': -1.0 } },
			(data) => {
			  if (g_record.length) {
			    var p = parseFloat(data.diagnostics.winprob)
			    g_record[ g_record.length - 1].p = p // Remember win prob of position
			    g_complete_record[ g_record.length - 1].p = p
			  }
			  show_prob( update_emo, playing)
			  if (completion) { completion(data) }
        if (g_play_btn_buffer) { // Buffered play button click
          botmove_if_active()
        }
        if (g_click_coord_buffer) { // user clicked while waiting, do it now
          board_click_callback( g_click_coord_buffer)
        }
        g_play_btn_buffer = false
        g_click_coord_buffer = null
			})
  } // get_prob()

  //------------------------------------------
  function show_prob( update_emo, playing) {
    var n = g_record.length - 1
    if (n >= 0) {
      var p = g_record[n].p
      if (p == 0) {
        set_emoji(); $('#status').html('')
        return
      }
      if (playing && !settings('show_prob')) {
        $('#status').html('')
      } else {
        $('#status').html( 'P(B wins): ' + p.toFixed(2))
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
    if (p == 0) { set_emoji(); return }
    if (n > 0) {
      if (g_record[n].mv == 'pass') {  set_emoji(); return }
      if (g_record[n-1].mv == 'pass') {  set_emoji(); return }
      var pp = g_record[n-1].p
      if (n % 2) { // we are white
        p = 1.0 - p; pp = 1.0 - pp
      }
      if (p < 0.05) { set_emoji() } // empty
      else if (p > 0.95) { set_emoji(0.0) } // happy
      else if (pp == 0) { set_emoji() } // empty
      else { set_emoji( pp - p) }
    }
    else {
      set_emoji()
    }
  } // update_emoji()

  //----------------------------------
  function set_emoji( delta_prob) {
    var emo_id = '#emo'
    if (typeof delta_prob == 'undefined') {
      $(emo_id).html( '&nbsp;')
      return
    }
    const MOVE_EMOJI = ['😍','😐','😓','😡']
    const PROB_BINS = [0.03, 0.06, 0.1]
    var emo = MOVE_EMOJI[3]
    for (var i=0; i < PROB_BINS.length; i++) {
      if (delta_prob < PROB_BINS[i]) {
        emo = MOVE_EMOJI[i]; break;
      }
    }
    //$(emo_id).html( '&nbsp;' + emo)
    $(emo_id).html( emo)
  } // set_emoji()

  //==========
  // Scoring
  //==========

  // Score the current position. Endpoint is 'score' or 'nnscore'.
  //----------------------------------------------------------------
  function score_position( endpoint)
  {
    axutil.hit_endpoint( KATAGO_SERVER + endpoint, {'board_size': BOARD_SIZE, 'moves': moves_only(g_record), 'tt':Math.random() },
			(data) => {
			  plot_histo(data, (surepoints) => {
          score_position.white_probs = data.white_probs
			    if (surepoints < 250) {
			      alert( 'Too early to score. Sorry.')
			      return
			    }
			    score_position.active = true
			    var node = g_jrecord.createNode( true)
			    for (var bpoint of data.territory.black_points) {
			      var coord = rc2jcoord( bpoint[0], bpoint[1])
			      if (node.jboard.stones [coord.i] [coord.j] != 1) {
				      node.setMark( rc2jcoord( bpoint[0], bpoint[1]), JGO.MARK.BLACK_TERRITORY)
			      }
			    }
			    for (var wpoint of data.territory.white_points) {
			      var coord = rc2jcoord( wpoint[0], wpoint[1])
			      if (node.jboard.stones [coord.i] [coord.j] != 2) {
				      node.setMark( rc2jcoord( wpoint[0], wpoint[1]), JGO.MARK.WHITE_TERRITORY)
			      }
			    }
			    for (var dpoint of data.territory.dame_points) {
			      node.setMark( rc2jcoord( dpoint[0], dpoint[1]), JGO.MARK.TRIANGLE)
			    }
			    var black_points = data.result[0]
			    var white_points = data.result[1]
			    var diff = Math.abs( black_points - white_points)
			    var rstr = `W+${diff} <br>(before komi and handicap)`
			    if (black_points >= white_points) { rstr = `B+${diff}  <br>(before komi and handicap)` }
			    $('#status').html( `B:${black_points} &nbsp; W:${white_points} &nbsp; ${rstr}`)
			  }) // plot_histo()
			} // (data) =>
		) // hit_endpoint()
  } // score_position()
  score_position.active = false
  score_position.white_probs = []

  // Plot histogram of territory probabilities
  //---------------------------------------------
  function plot_histo( data, completion) {
    var wp = data.white_probs
    axutil.hit_endpoint( '/histo', [wp,20,0,1], (res) => {
      //var surepoints = res[0][1] + res[res.length-1][1]
      var surepoints = BOARD_SIZE * BOARD_SIZE - data.dame
      axutil.barchart( '#histo', res, 240)
      completion( surepoints)
    })
  } // plot_histo()

  //===============
  // Converters
  //===============

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

  // Show a translucent hover stone
  //---------------------------------
  function hover( coord, col, opts) {
    opts = opts || {}
    if (!opts.force) {
      if (p_options.mobile && col) { return }
    }
    var hcol = col ? col: g_player
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
      }
    }
    else if (hover.coord) {
      jboard.setType( hover.coord, col == JGO.CLEAR)
      hover.coord = null
      replay_move_list( g_record) // remove artifacts
    }
  } // hover()
  hover.coord = null

  // Get a value from the settings screen via localStorage
  //--------------------------------------------------------
  function settings( key, value) {
    const settings_defaults = { show_emoji:false, show_prob:false }
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

  // Save game record once a minute
  function statesaver() {
    save_state();
    setTimeout(statesaver, 60000)
  }
  statesaver()

  $('#histo').hide()

} // function main()
