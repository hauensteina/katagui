

/*
* Main entry point for katago-gui
* AHN Jan 2020
*/

'use strict'

const HANDISTONES = ['', ''
  , ['D4', 'Q16']
  , ['D4', 'Q16', 'Q4']
  , ['D4', 'Q16', 'Q4', 'D16']
  , ['D4', 'Q16', 'Q4', 'D16', 'K10']
  , ['D4', 'Q16', 'Q4', 'D16', 'D10', 'Q10']
  , ['D4', 'Q16', 'Q4', 'D16', 'D10', 'Q10', 'K10']
  , ['D4', 'Q16', 'Q4', 'D16', 'D10', 'Q10', 'K4', 'K16']
  , ['D4', 'Q16', 'Q4', 'D16', 'D10', 'Q10', 'K4', 'K16', 'K10']
]


//=======================================
function main(JGO, axutil, p_options) {
  $ = axutil.$
  const settings = axutil.settings

  const BOT = 'katago_gtp_bot'
  const BOARD_SIZE = 19

  var g_jrecord = new JGO.Record(BOARD_SIZE)
  var g_jsetup = new JGO.Setup(g_jrecord.jboard, JGO.BOARD.largeWalnut)
  var g_ko = null // ko coordinate
  var g_last_move = null // last move coordinate
  var g_play_btn_buffer = false // buffer one play btn click
  var g_best_btn_buffer = false // buffer one best btn click
  var g_click_coord_buffer = null // buffer one board click
  // prisoner count; elt 0 unused; prisoners[1] counts the white stones who are B's prisoners;
  var g_prisoners = [0, 0, 0]

  var g_komi = 6.5
  var g_handi = 0

  //================
  // UI Callbacks
  //================

  //-----------------------------------
  function set_dropdown_handlers() {
    $('#komi_menu').html(g_komi)
    $('#komi_m505').click(function () { $('#komi_menu').html('-50.5') })
    $('#komi_m405').click(function () { $('#komi_menu').html('-40.5') })
    $('#komi_m305').click(function () { $('#komi_menu').html('-30.5') })
    $('#komi_m205').click(function () { $('#komi_menu').html('-20.5') })
    $('#komi_m105').click(function () { $('#komi_menu').html('-10.5') })
    $('#komi_05').click(function () { $('#komi_menu').html('0.5') })
    $('#komi_65').click(function () { $('#komi_menu').html('6.5') })
    $('#komi_75').click(function () { $('#komi_menu').html('7.5') })

    $('#handi_menu').html(g_handi)
    $('#handi_0').click(function () { $('#handi_menu').html('0'); $('#komi_menu').html('6.5') })
    $('#handi_1').click(function () { $('#handi_menu').html('1'); $('#komi_menu').html('0.5') })
    $('#handi_2').click(function () { $('#handi_menu').html('2'); $('#komi_menu').html('0.5') })
    $('#handi_3').click(function () { $('#handi_menu').html('3'); $('#komi_menu').html('0.5') })
    $('#handi_4').click(function () { $('#handi_menu').html('4'); $('#komi_menu').html('0.5') })
    $('#handi_5').click(function () { $('#handi_menu').html('5'); $('#komi_menu').html('0.5') })
    $('#handi_6').click(function () { $('#handi_menu').html('6'); $('#komi_menu').html('0.5') })
    $('#handi_7').click(function () { $('#handi_menu').html('7'); $('#komi_menu').html('0.5') })
    $('#handi_8').click(function () { $('#handi_menu').html('8'); $('#komi_menu').html('0.5') })
    $('#handi_9').click(function () { $('#handi_menu').html('9'); $('#komi_menu').html('0.5') })

    $('#game_start').click(function () { // New Game -> Go
      end_game()
      $('#donate_modal').html('')
      g_handi = parseInt($('#handi_menu').html())
      g_komi = parseFloat($('#komi_menu').html())
      reset_game();
      $('#lb_komi').html(tr('Komi') + ': ' + g_komi)
      set_emoji();
      bot_active('on')
      clear_status()

      // create new game in db
      axutil.hit_endpoint_simple('/create_game', { 'handicap': g_handi, 'komi': g_komi },
        (resp) => {
          settings('game_hash', resp.game_hash)
          if (g_handi > 1) { botmove_if_active() }
        })
    })

    $('#cancel_new_game').click(function () { // New Game -> x
      $('#donate_modal').html('')
    })
  } // set_dropdown_handlers()

  // BLACK or WHITE depending on grec.pos()
  //------------------------------------------
  function turn(idx_) {
    var idx = idx_ || grec.pos()
    if (idx % 2) {
      return JGO.WHITE
    }
    return JGO.BLACK
  } // turn()

  //------------------------------------------
  function board_click_callback(coord) {
    selfplay('off')
    if (coord.i < 0 || coord.i > 18) { return }
    if (coord.j < 0 || coord.j > 18) { return }
    //SLOG(navigator.userAgent.toLowerCase())
    if (score_position.active) { goto_move(grec.pos()); return }

    if ($('#btn_tgl_number').hasClass('btn-success')) return add_mark(coord, 'number')
    if ($('#btn_tgl_letter').hasClass('btn-success')) return add_mark(coord, 'letter')
    if ($('#btn_tgl_x').hasClass('btn-success')) return add_mark(coord, 'X')
    if ($('#btn_tgl_triangle').hasClass('btn-success')) return add_mark(coord, 'triangle')
    if ($('#btn_tgl_circle').hasClass('btn-success')) return add_mark(coord, 'circle')

    var jboard = g_jrecord.jboard
    if ((jboard.getType(coord) == JGO.BLACK) || (jboard.getType(coord) == JGO.WHITE)) { return }
    if (axutil.hit_endpoint('waiting')) {
      g_click_coord_buffer = coord
      return
    }
    // clear hover away
    hover()

    // Add the new move
    maybe_start_var()
    var mstr = axutil.jcoord2string(coord) // This rotates the move if necessary
    grec.push({ 'mv': mstr, 'p': 0.0, 'agent': 'human' })
    board_click_callback.illegal_move = false
    goto_move(grec.len())
    // Silently ignore illegal ko takes
    if (board_click_callback.illegal_move) { 
      grec.pop()
      goto_move(grec.len())
      return
    }
    add_mark('redraw')
    set_emoji()
    var greclen = grec.len()
    const playing = true
    get_prob_genmove(
      (data) => {
        if (bot_active() && (greclen == grec.len())) { bot_move_callback(data) }
      },
      settings('show_emoji'), playing)
  } // board_click_callback()
  board_click_callback.illegal_move = false

  // Put a mark on a stone or intersection. 
  // Reset if coord == 'clear'.
  // marktype is one of 'letter', 'number', 'triangle'.
  //------------------------------------------------------
  function add_mark(rotated_coord, marktype) {

    function remove_mark(mark, orig_coord) {
      add_mark.orig_coords[mark] = add_mark.orig_coords[mark].filter(c => (c.i !== orig_coord.i) || (c.j !== orig_coord.j))
    } // remove_mark()

    function get_mark(orig_coord) {
      var l_list = add_mark.orig_coords['letter'].filter(c => (c.i !== orig_coord.i) || (c.j !== orig_coord.j))
      if (l_list.length < add_mark.orig_coords['letter'].length) { return 'letter' }
      var n_list = add_mark.orig_coords['number'].filter(c => (c.i !== orig_coord.i) || (c.j !== orig_coord.j))
      if (n_list.length < add_mark.orig_coords['number'].length) { return 'number' }
      var t_list = add_mark.orig_coords['triangle'].filter(c => (c.i !== orig_coord.i) || (c.j !== orig_coord.j))
      if (t_list.length < add_mark.orig_coords['triangle'].length) { return 'triangle' }
      var o_list = add_mark.orig_coords['circle'].filter(c => (c.i !== orig_coord.i) || (c.j !== orig_coord.j))
      if (o_list.length < add_mark.orig_coords['circle'].length) { return 'circle' }
      var x_list = add_mark.orig_coords['X'].filter(c => (c.i !== orig_coord.i) || (c.j !== orig_coord.j))
      if (x_list.length < add_mark.orig_coords['X'].length) { return 'X' }
      return ''
    } // get_mark()

    function redraw_marks() {
      var idx = 0
      add_mark.orig_coords['number'].forEach(c => {
        idx++; node.setMark(axutil.rot_coord(c), '' + idx)
      })
      var lidx = -1
      add_mark.orig_coords['letter'].forEach(c => {
        lidx++; node.setMark(axutil.rot_coord(c), letters[lidx])
      })
      add_mark.orig_coords['X'].forEach(c => {
        node.setMark(axutil.rot_coord(c), 'X')
      })
      add_mark.orig_coords['triangle'].forEach(c => {
        node.setMark(axutil.rot_coord(c), JGO.MARK.TRIANGLE)
      })
      add_mark.orig_coords['circle'].forEach(c => {
        node.setMark(axutil.rot_coord(c), JGO.MARK.CIRCLE)
      })
    } // redraw_marks()

    var letters = 'abcdefghiklmnopqrstuvwxyz'
    var node = g_jrecord.createNode(true)
    replay_moves(grec.pos()) // remove artifacts, preserve mark on last play

    if (rotated_coord == 'clear') {
      add_mark.orig_coords = { 'letter': [], 'number': [], 'X': [], 'triangle': [], 'circle': [] }
      redraw_marks()
      return
    }
    else if (rotated_coord == 'redraw') {
      redraw_marks()
      return
    }
    else {
      var orig_coord = axutil.invrot_coord(rotated_coord)
      var mark = get_mark(orig_coord)
      if (mark) { remove_mark(mark, orig_coord) }
      else { add_mark.orig_coords[marktype].push(orig_coord) }
      redraw_marks()
      return
    }
  } // add_mark()
  add_mark.orig_coords = { 'letter': [], 'number': [], 'X': [], 'triangle': [], 'circle': [] }

  //-------------------------------
  function best_btn_callback() {
    selfplay('off')
    set_status(tr('KataGo is thinking ...'))
    best_btn_callback.active = true
    get_best_move((data) => {
      show_best_moves(data)
    })
  } // best_btn_callback()
  best_btn_callback.active = false

  //----------------------------------
  function show_best_moves(data) {
    if (data) { show_best_moves.data = data }
    data = show_best_moves.data
    var botCoord = axutil.string2jcoord(data.bot_move)
    var best = data.diagnostics.best_ten // candidate moves sorted descending by psv
    var node = g_jrecord.createNode(true)
    replay_moves(grec.pos()) // remove artifacts, preserve mark on last play
    var mmax = 0
    // Mark candidates with letters if psv is close enough to max
    var bardata = []
    for (const [idx, m] of best.entries()) {
      bardata.push([idx, m.psv])
      if (mmax == 0) { mmax = m.psv }
      if (!settings('show_best_ten') && m.psv < 0.05 * mmax) continue
      var botCoord1 = axutil.string2jcoord(m.move)
      if (botCoord1 != 'pass' && botCoord1 != 'resign') {
        var letter = String.fromCharCode('A'.charCodeAt(0) + idx)
        node.setMark(botCoord1, letter)
      }
    } // for
    var maxi = Math.max(...bardata.map(function (d) { return d[1] }))
    //console.log(maxi)
    var font = '10px sans-serif'
    if (p_options.mobile) { font = '20px sans-serif' }
    axutil.barchart('#status', bardata, 1.2 * maxi, font)
    // Also show score and winning prob
    var scorestr = get_scorestr(data.diagnostics.winprob, data.diagnostics.score)
    $('#bestscore').html(scorestr)
    $('#bestscore').css({ 'font': '10px sans-serif' })
    if (p_options.mobile) { $('#bestscore').css({ 'font': '20px sans-serif' }) }
  } // show_best_moves()
  show_best_moves.data = {}

  // Make a string like 'P(B wins): 0.56  B+0.5'
  //----------------------------------------------
  function get_scorestr(p, score) {
    score = Math.trunc(Math.abs(score) * 2 + 0.5) * Math.sign(score) / 2.0
    var scorestr = '&nbsp;&nbsp;' + tr('B') + '+'
    if (score < 0) {
      scorestr = '&nbsp;&nbsp;' + tr('W') + '+'
    }
    scorestr += Math.abs(score)
    var res = tr('P(B wins)') + ': ' + p.toFixed(2)
    if (typeof (score) !== 'undefined') {
      res += scorestr
    }
    if (p == 0 && score == 0) { res = '' }
    return res
  } // get_scorestr()

  // Black moves at the beginning are handicap
  //--------------------------------------------
  function get_handicap() {
    g_handi = 0
    var handi = 0
    var rec = grec.prefix(20)
    for (var i = 0; i < rec.length; i++) {
      if (i % 2) { // white
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
    g_jsetup.setOptions({ stars: { points: 9 } })
    // Add mouse event listeners for the board
    //------------------------------------------
    g_jsetup.create('board',
      function (canvas) {
        //----------------------------
        canvas.addListener('click', function (coord, ev) { board_click_callback(coord) });

        //------------------------------
        canvas.addListener('mousemove',
          function (coord, ev) {
            var jboard = g_jrecord.jboard
            if (coord.i == -1 || coord.j == -1)
              return
            if (coord == hover.coord)
              return

            hover(coord, turn())
            if (score_position.active) {
              draw_estimate(score_position.probs)
            }
            else if (best_btn_callback.active) {
              show_best_moves()
            }
          }
        ) // mousemove

        //----------------------------
        canvas.addListener('mouseout',
          function (ev) {
            hover()
            if (score_position.active) {
              draw_estimate(score_position.probs)
            }
            else if (best_btn_callback.active) {
              show_best_moves()
            }
          }
        ) // mouseout
      } // function(canvas)
    ) // create board
  } // setup_jgo()

  // Set button callbacks
  //------------------------------
  function set_btn_handlers() {
    set_load_sgf_handler()
    var_button_state('off')

    // $('#username').click( () => {
    //   show_move.mark_last_move = !show_move.mark_last_move
    // })

    function deativate_mark_toggles() {
      $('#btn_tgl_number').removeClass('btn-success')
      $('#btn_tgl_number').css('background-color', '')
      $('#btn_tgl_letter').removeClass('btn-success')
      $('#btn_tgl_letter').css('background-color', '')
      $('#btn_tgl_x').removeClass('btn-success')
      $('#btn_tgl_x').css('background-color', '')
      $('#btn_tgl_triangle').removeClass('btn-success')
      $('#btn_tgl_triangle').css('background-color', '')
      $('#btn_tgl_circle').removeClass('btn-success')
      $('#btn_tgl_circle').css('background-color', '')
    } // deativate_mark_toggles()

    function activate_mark_toggle(btn) {
      var wasoff = 1
      if (btn.hasClass('btn-success')) wasoff = 0
      deativate_mark_toggles()
      if (wasoff) {
        btn.addClass('btn-success')
        btn.css('background-color', 'green')
      }
    } // activate_mark_toggle()

    $('#btn_tgl_number').click(() => {
      activate_mark_toggle($('#btn_tgl_number'))
    })

    $('#btn_tgl_letter').click(() => {
      activate_mark_toggle($('#btn_tgl_letter'))
    })

    $('#btn_tgl_mark').click(() => {
      var btn = $('#btn_tgl_mark')
      if (btn.hasClass('btn-success')) {
        show_move.mark_last_move = false
        btn.removeClass('btn-success')
        btn.css('background-color', '')
      } else {
        show_move.mark_last_move = true
        btn.addClass('btn-success')
        btn.css('background-color', 'green')
      }
      replay_moves(grec.pos())
      add_mark('redraw')
    }) // btn_tgl_mark

    $('#btn_tgl_rot').click(() => {
      var btn = $('#btn_tgl_rot')
      var rot = (axutil.getRotation() + 1) % 8
      axutil.setRotation(rot)
      replay_moves(grec.pos())
      add_mark('redraw')
      if (rot == 0) {
        btn.removeClass('btn-success')
        btn.css('background-color', '')
      } else {
        btn.addClass('btn-success')
        btn.css('background-color', 'green')
      }
    }) // btn_tgl_rot

    $('#btn_tgl_swap_colors').click(() => {
      var btn = $('#btn_tgl_swap_colors')
      if (show_move.swap_colors) {
        show_move.swap_colors = false
        replay_moves(grec.pos())
        add_mark('redraw')
        btn.removeClass('btn-success')
        btn.css('background-color', '')
      } else {
        show_move.swap_colors = true
        replay_moves(grec.pos())
        add_mark('redraw')
        btn.addClass('btn-success')
        btn.css('background-color', 'green')
      }
    }) // btn_tgl_swap_colors

    $('#btn_export_diagram').click(() => {
      let node = g_jrecord.getCurrentNode()
      let marks = JSON.stringify(node.jboard.marks)
      let stones = JSON.stringify(node.jboard.stones)
      var rec = axutil.moves_only(grec.all_moves())
      // kludge to manage passes
      for (var i = 0; i < rec.length; i++) {
        if (rec[i] == 'pass') { rec[i] = 'A0' }
      }
      var moves = rec.join('')
      var meta = set_load_sgf_handler.loaded_game
      if (!meta) {
        meta = {}
        meta.komi = g_komi
      }

      let url = '/export_diagram?q=' + Math.random() +
        '&stones=' + encodeURIComponent(stones) +
        '&marks=' + encodeURIComponent(marks) +
        '&moves=' + encodeURIComponent(moves) +
        '&pb=' + encodeURIComponent(meta.pb) +
        '&pw=' + encodeURIComponent(meta.pw) +
        '&km=' + encodeURIComponent(meta.komi) +
        '&re=' + encodeURIComponent(meta.RE) +
        '&dt=' + encodeURIComponent(meta.DT)

      window.location.href = url
    }) // btn_export_diagram

    $('#btn_tgl_x').click(() => {
      activate_mark_toggle($('#btn_tgl_x'))
    })

    $('#btn_tgl_triangle').click(() => {
      activate_mark_toggle($('#btn_tgl_triangle'))
    })

    $('#btn_tgl_circle').click(() => {
      activate_mark_toggle($('#btn_tgl_circle'))
    })

    $('#btn_clear').click(() => {
      add_mark('clear')
    })

    $('#img_bot, #descr_bot').click(() => {
      selfplay('off')
      fast_or_strong('toggle')
    })

    $('#btn_tgl_guest').click(() => {
      $('#donate_modal').html('\&nbsp;')
      fast_or_strong('guest')
    })

    $('#btn_tgl_fast').click(() => {
      fast_or_strong('fast')
    })

    $('#btn_tgl_strong').click(() => {
      fast_or_strong('strong')
    })

    $('#btn_clear_var').click(() => {
      selfplay('off')
      if ($('#btn_clear_var').hasClass('disabled')) { return }
      handle_variation('clear')
      if (settings('game_hash')) { // we are in an active game
        grec.dbsave() // save and notify observers
      }
    })

    $('#btn_watch').click(() => {
      if (p_options.mobile) {
        location.href = 'watch_select_game_mobile'
      } else {
        location.href = 'watch_select_game'
      }
    })

    $('#btn_play').click(() => {
      selfplay('off')
      set_emoji()
      //bot_active( 'on')
      //botmove_if_active()
      get_katago_move()
    })

    $('#btn_tgl_selfplay').click(() => {
      selfplay('toggle')
    })

    // Autoplay slider
    $('#opt_auto').click(() => {
      selfplay('off')
      var state = $('#opt_auto').prop('checked')
      if (state) { bot_active('on') }
      else { bot_active('off') }
    })


    $('#btn_best').click(() => {
      btn_best()
    })

    $('#btn_save').click(() => {
      selfplay('off')
      var rec = axutil.moves_only(grec.all_moves())
      var probs = axutil.probs_only(grec.all_moves())
      var scores = axutil.scores_only(grec.all_moves())
      for (var i = 0; i < probs.length; i++) { probs[i] = probs[i].toFixed(2) }
      for (var i = 0; i < scores.length; i++) { scores[i] = scores[i] ? scores[i].toFixed(1) : '0.0' }
      // Kludge to manage passes
      for (var i = 0; i < rec.length; i++) {
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

    $('#btn_nnscore').click(() => {
      selfplay('off')
      if (score_position.active) {
        goto_move(grec.pos())
        return
      }
      score_position()
    })

    $('#btn_bot').click(() => {
      selfplay('off')
      fast_or_strong('toggle')
    })

    $('#btn_pass').click(() => {
      selfplay('off')
      if (score_position.active) { goto_move(grec.pos()); return }
      maybe_start_var()
      grec.push({ 'mv': 'pass', 'p': 0, 'agent': 'human' })
      goto_move(grec.len())
      botmove_if_active()
    })

    $('#btn_undo').click(() => {
      selfplay('off')
      axutil.hit_endpoint('cancel')
      var at_end = (grec.pos() == grec.len())
      //if (grec.pos() > 2 && grec.curmove().agent.indexOf('kata') >= 0 && grec.prevmove().agent == 'human') {
      //  goto_move( grec.pos() - 2 )
      //} else {
      goto_move(grec.pos() - 1)
      //}
      if (at_end) {
        grec.truncate()
        if (settings('game_hash')) { // we are in an active game
          grec.dbsave() // save and notify observers
        }
      }
      show_movenum()
    })

    $('#btn_prev').click(btn_prev)
    $('#btn_next').click(btn_next)
    $('#btn_back10').click(() => { selfplay('off'); goto_move(grec.pos() - 10); update_emoji(); bot_active('off'); add_mark('redraw') })
    $('#btn_fwd10').click(() => { selfplay('off'); goto_move(grec.pos() + 10); update_emoji(); bot_active('off'); add_mark('redraw') })
    $('#btn_first').click(() => { selfplay('off'); goto_move(0); set_emoji(); bot_active('off'); clear_status(); add_mark('redraw') })
    $('#btn_last').click(() => { selfplay('off'); goto_move(grec.len()); update_emoji(); bot_active('off'); add_mark('redraw') })

    // Prevent zoom on double tap
    $('*').on('touchend', (e) => {
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
    $('a').on('touchend', (e) => {
      //console.log('a')
      e.preventDefault()
      e.target.click()
    })
    // Buttons should still work
    $('[id^=btn_]').on('touchstart', (e) => {
      e.preventDefault()
      e.target.click()
      if (e.target.id.indexOf('_tgl_') <= 0) {
        $(e.target).css('background-color', '#040404')
        setTimeout(() => {
          $(e.target).css('background-color', '#CCCCCC')
        }, 100)
      }
    })
  } // set_btn_handlers()

  // Start and stop selfplay
  //--------------------------
  function selfplay(action) {
    if (action == 'on') {
      $('#btn_tgl_selfplay').css('background-color', 'rgb(40, 167, 69)')
      fast_or_strong('fast')
      selfplay.ready = true
      return $('#btn_tgl_selfplay').addClass('btn-success')
    }
    else if (action == 'off') {
      $('#btn_tgl_selfplay').css('background-color', '')
      return $('#btn_tgl_selfplay').removeClass('btn-success')
    }
    else if (action == 'ison') {
      return $('#btn_tgl_selfplay').hasClass('btn-success')
    }

    // action == 'toggle'
    if (selfplay('ison')) {
      return selfplay('off')
    }
    selfplay('on')
    var interval = 4000
    if (settings('selfplay_speed')) {
      if (settings('selfplay_speed') == 'fast') { interval = 3000 }
      else if (settings('selfplay_speed') == 'slow') { interval = 5000 }
    }
    cb_selfplay()

    function cb_selfplay() { // timer callback
      clearTimeout(selfplay.timer)
      clear_status()
      if (selfplay('ison')) {
        selfplay.timer = setTimeout(cb_selfplay, interval)
      }
      if (document.visibilityState != 'visible') return
      if (!settings('logged_in')) {
        selfplay('off')
        $('#alertbox_title').html('')
        $('#alertbox_message').html(tr('Please Log In'))
        $('#alertbox').modal('show')
        return
      }
      set_emoji()
      if (selfplay.ready) {
        selfplay.ready = false

        // Looping on existing game
        if (grec.pos() < grec.len()) {
          selfplay.ready = true
          if (!selfplay('ison')) return;
          goto_move(grec.pos() + 1)
          if (grec.curmove().p == 0) {
            get_prob_genmove((data) => {
              if (!settings('show_prob')) { clear_status() }
              if (settings('show_emoji')) { update_emoji() }
            })
          }
          else {
            if (!settings('show_prob')) { clear_status() }
            if (settings('show_emoji')) { update_emoji() }
          }
          return
        }

        function selfplay_game_over() {
          if (!grec.curmove()) { return false }
          else if (grec.pos() < 150) { return false }
          else if (g_handi < 2 && (grec.curmove().p < 0.02 || grec.curmove().p > (1.0 - 0.02))) { return true }
          else if (g_handi < 3 && (grec.curmove().p < 0.01 || grec.curmove().p > (1.0 - 0.01))) { return true }
          else if (grec.curmove().score > 10.0) {
            if (grec.curmove().p < 0.001 || grec.curmove().p > (1.0 - 0.001)) { return true }
          }
          return false
        } // selfplay_game_over()

        // If game ended, start from beginning
        if (grec.curmove()) {
          if (selfplay_game_over()
            || set_load_sgf_handler.loaded_game) // we're at the end of a loaded game
          {
            selfplay.ready = true
            if (!selfplay('ison')) return;
            grec.update(0, 0)
            goto_move(0)
            clear_status()
            return
          }
        }

        // Continue game
        axutil.hit_endpoint(fast_or_strong('fast').ep + BOT,
          { 'board_size': BOARD_SIZE, 'moves': axutil.moves_only(grec.board_moves()), 'config': { 'komi': g_komi }, 'selfplay': 1 },
          (data) => {
            selfplay.ready = true
            if (!selfplay('ison')) return;
            var botCoord = axutil.string2jcoord(data.bot_move)
            maybe_start_var()
            grec.push({ 'mv': data.bot_move, 'p': 0, 'score': 0, 'agent': 'kata20' })
            replay_moves(grec.pos())
            const playing = true
            get_prob_callback(data.diagnostics.winprob, data.diagnostics.score, settings('show_emoji'), playing)
          }) // hit_endpoint()
      } // if ready
    } // cb_selfplay()
    return 0
  } // selfplay()
  selfplay.ready = true
  selfplay.timer = null

  // Load Sgf button
  //-----------------------------------
  function set_load_sgf_handler() {
    $('#sgf-file').on('change', function () {
      var input = $(this)
      var myfile = input.get(0).files[0]
      var numFiles = input.get(0).files ? input.get(0).files.length : 1
      var label = input.val().replace(/\\/g, '/').replace(/.*\//, '')
      handle_variation('clear')
      // Call API to get the moves, then replay on the board
      axutil.upload_file('/sgf2list', myfile, (response) => {
        var res = response.result
        var moves = res.moves
        $('#lb_komi').html(tr('Komi') + ': ' + res.komi)
        set_emoji()
        end_game()
        grec = new GameRecord()
        for (var move of moves) {
          var move_prob = { 'mv': move, 'p': 0, 'agent': '' }
          grec.push(move_prob)
        }
        replay_moves(grec.pos())
        show_movenum()
        g_komi = res.komi
        get_handicap()
        show_game_info(res)
        clear_status()
        set_load_sgf_handler.loaded_game = res
        $('#sgf-file').val('') // reset to make sure it triggers again
      })
    }) // $('sgf-file')
  } // set_load_sgf_handler()

  //-----------------------------------------
  function show_game_info(loaded_game) {
    if (loaded_game) {
      $('#game_info').html(
        `${tr('B')}:${loaded_game.pb} &nbsp;&nbsp; ${tr('W')}:${loaded_game.pw} &nbsp;&nbsp;
          ${tr('Result')}:${loaded_game.RE} &nbsp;&nbsp; ${tr('Date')}:${loaded_game.DT}`)
      $('#fname').html(loaded_game.fname)
    } else {
      $('#game_info').html('')
      $('#fname').html('')
    }
  } // show_game_info()

  //-------------------------
  function btn_prev() {
    selfplay('off');
    if (!grec.len()) return
    goto_move(grec.pos() - 1); update_emoji(); bot_active('off')
    add_mark('redraw')

    if (grec.curmove().data) {
      if (settings('show_best_moves')) { show_best_moves(grec.curmove().data) }
    } 
  } // btn_prev()

  //-------------------------
  function btn_next() {
    selfplay('off');
    if (!grec.len()) return
    if (btn_next.waiting) { btn_next.buffered = true; btn_next.waiting = false; return }
    goto_move(grec.pos() + 1)
    add_mark('redraw')
    // Do not analyze handicap stones
    if (grec.pos() < 20 && grec.len() > grec.pos() && grec.nextmove().mv == 'pass') {
      goto_move(grec.pos() + 1)
      return
    }
    if (grec.curmove().data) {
      if (settings('show_best_moves')) { show_best_moves(grec.curmove().data) }
    } 
    else {
      btn_next.waiting = true
      get_prob_genmove((data) => {
        grec.curmove().data = data  
        update_emoji()
        if (settings('show_best_moves')) { 
          show_best_moves(data) 
        }
        bot_active('off')
        btn_next.waiting = false
        if (btn_next.buffered) {
          btn_next.buffered = false
          btn_next()
        }
      })
      return
    } // else
    update_emoji()
    bot_active('off')
  } // btn_next()
  btn_next.waiting = false
  btn_next.buffered = false

  //----------------------
  function btn_best() {
    selfplay('off')
    if (score_position.active) return
    if (axutil.hit_endpoint('waiting')) {
      g_best_btn_buffer = true; return
    }
    best_btn_callback()
  } // btn_best()

  // Key actions
  //------------------------
  function check_key(e) {
    e = e || window.event;
    //console.log(e.keyCode)
    if (e.keyCode == '17') { // ctrl
      check_key.ctrl_pressed = true
      return
    }
    else if (e.keyCode == '38') { // up arrow
      e.preventDefault()
      btn_best()
    }
    // Ctrl-down toggles mark-last-move
    else if (check_key.ctrl_pressed && e.keyCode == '40') { // down arrow
      show_move.mark_last_move = !show_move.mark_last_move
    }
    else if (e.keyCode == '37') { // left arrow
      btn_prev()
    }
    else if (e.keyCode == '39') { // right arrow
      btn_next()
    }
    else if (e.keyCode == '32') { // space bar
      selfplay('toggle')
    }
    check_key.ctrl_pressed = false
  } // check_key()
  check_key.ctrl_pressed = false

  //===================
  // Bot Interaction
  //===================

  //-----------------------------
  function get_katago_move() {
    set_status(tr('KataGo is thinking ...'))
    var greclen = grec.len()
    axutil.hit_endpoint(fast_or_strong().ep + BOT, {
      'board_size': BOARD_SIZE, 'moves': axutil.moves_only(grec.board_moves()),
      'config': { 'komi': g_komi }
    },
      (data) => {
        if (greclen == grec.len()) { // user did not click in the meantime
          if (settings('play_a')) {
            data.bot_move = data.diagnostics.best_ten[0].move
          }
          bot_move_callback(data)
        }
      })
  } // get_katago_move()

  //--------------------------------
  function botmove_if_active() {
    if (axutil.hit_endpoint('waiting')) {
      g_play_btn_buffer = true; return true
    }
    if (!bot_active()) { return true }
    get_katago_move()
    return true
  } // botmove_if_active()

  // Do things after the bot came back with move and estimate
  //------------------------------------------------------------
  function bot_move_callback(data) {
    hover() // The board thinks the hover stone is actually there. Clear it.
    var botprob = data.diagnostics.winprob; var botcol = 'Black'
    if (turn() == JGO.WHITE) { botprob = 1.0 - botprob; botcol = 'White' }

    if (data.bot_move == 'pass') {
      alert(tr('KataGo passes. Click on the Score button.'))
      clear_status()
    }
    else if (data.bot_move == 'resign') {
      alert(tr('KataGo resigns.'))
      set_status(tr('KataGo resigns.'))
      return
    }
    else if ((var_button_state() == 'off') && (grec.pos() > 150) && ( // do not resign in variation or too early
      (g_handi < 3 && botprob < 0.01) ||
      (g_handi < 2 && botprob < 0.02) ||
      (botprob < 0.001))
      && (data.diagnostics.score > 10.0) // Do not resign unless B has a 10 point lead
    ) {
      alert(tr('KataGo resigns. You beat KataGo!'))
      set_status(tr('KataGo resigns.'))
      return
    }
    else {
      maybe_start_var()
    }
    grec.push({ 'mv': data.bot_move, 'p': 0.0, 'score': 0.0, 'agent': fast_or_strong().name })
    replay_moves(grec.pos())
    show_movenum()
    add_mark('redraw')
    const show_emoji = false
    const playing = true
    get_prob_callback(data.diagnostics.winprob, data.diagnostics.score, show_emoji, playing)
  } // bot_move_callback()

  //-----------------------------------
  function bot_active(on_or_off) {
    if (typeof on_or_off == 'undefined') {
      return $('#opt_auto').prop('checked')
    }
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
    return 0
  } // bot_active()

  //========
  // Moves
  //========

  // Show a move on the board. 
  // player == 1 or 2 meaning black or white
  //--------------------------------------------
  function show_move(player, coord) {
    if (coord == 'pass' || coord == 'resign') {
      g_ko = false
      return
    }
    if (show_move.swap_colors) {
      if (player == 1) { player = 2 }
      else { player = 1 }
    }
    var play = g_jrecord.jboard.playMove(coord, player, g_ko)
    if (play.success) {
      var node = g_jrecord.createNode(true)
      node.info.captures[player] += play.captures.length // tally captures
      g_prisoners[player] = node.info.captures[player]
      node.setType(coord, player) // play stone
      node.setType(play.captures, JGO.CLEAR) // clear opponent's stones

      if (g_last_move) {
        node.setMark(g_last_move, JGO.MARK.NONE) // clear previous mark
      }
      if (g_ko) {
        node.setMark(g_ko, JGO.MARK.NONE) // clear previous ko mark
      }
      if (show_move.mark_last_move) {
        node.setMark(coord, JGO.MARK.CIRCLE) // mark move
      }
      g_last_move = coord

      if (play.ko)
        node.setMark(play.ko, JGO.MARK.CIRCLE) // mark ko, too
      g_ko = play.ko
    } else {
      board_click_callback.illegal_move = true
    }
  } // show_move()
  show_move.mark_last_move = true
  show_move.swap_colors = false

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
    handle_variation('clear')
    set_load_sgf_handler.loaded_game = null
    show_game_info() // clear
    grec = new GameRecord()
    goto_first_move()
    if (g_handi < 2) { return }
    var hstones = HANDISTONES[g_handi]
    for (const [idx, s] of hstones.entries()) {
      if (idx > 0) {
        grec.push({ 'mv': 'pass', 'p': 0, 'agent': '' })
      }
      grec.push({ 'mv': s, 'p': 0, 'agent': '' })
    }
    goto_move(grec.len())
  } // reset_game()

  // The active game has ended.
  //----------------------------
  function end_game() {
    settings('game_hash', '')
  } // end_game()

  // Replay n moves from empty board.
  //------------------------------------
  function replay_moves(n) {
    goto_first_move()
    for (const [idx, move_prob] of grec.prefix(n).entries()) {
      var move_string = move_prob.mv
      var coord = axutil.string2jcoord(move_string)
      show_move(turn(idx), coord)
    }
    grec.seek(n)
    show_movenum()
  } // replay_moves()

  // Replay and show game up to move n
  //-------------------------------------
  function goto_move(n) {
    if (n == 0) { end_game() }
    n = Math.max(n, 2 * g_handi - 1)
    score_position.active = false
    best_btn_callback.active = false
    var totmoves = grec.len()
    if (n > totmoves) { n = totmoves }
    if (n < 1) { goto_first_move(); set_emoji(); return }
    replay_moves(n)
    show_movenum()
    show_prob()
  } // goto_move()

  //----------------------------
  function show_movenum() {
    //if (!grec.len()) { return }
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
  function handle_variation(action) {
    if (action == 'save') { // Save record and start a variation
      grec.enter_var()
      var_button_state('on')
    }
    else if (action == 'clear') { // Restore game record and forget the variation
      grec.exit_var()
      goto_move(grec.pos())
      update_emoji(); bot_active('off')
      var_button_state('off')
      clear_status()
    }
  } // handle_variation()

  // Start a variation if we're not at the end
  //---------------------------------------------
  function maybe_start_var() {
    if (grec.len() && grec.pos() < grec.len()) {
      handle_variation('save')
    }
  } // maybe_start_var()

  //-------------------------------------------
  function var_button_state(state) {
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

  //===============================
  // Saving and restoring state
  //===============================

  //--------------------------
  function save_state() {
    localStorage.setItem('fast_or_strong', fast_or_strong().val)
    if (var_button_state() == 'off') { // don't save if in variation
      localStorage.setItem('game_record', grec.dumps())
      localStorage.setItem('komi', JSON.stringify(g_komi))
      localStorage.setItem('bot_active', bot_active())
      localStorage.setItem('loaded_game', JSON.stringify(set_load_sgf_handler.loaded_game))
    }
  } // save_state()

  //--------------------------
  function load_state() {
    if (localStorage.getItem('fast_or_strong') == 'strong') {
      fast_or_strong('strong')
    }
    else if (localStorage.getItem('fast_or_strong') == 'fast') {
      fast_or_strong('fast')
    }
    else {
      fast_or_strong('guest')
    }
    if (localStorage.getItem('game_record') === null) { return }
    if (localStorage.getItem('game_record') === 'null') { return }
    set_load_sgf_handler.loaded_game = JSON.parse(localStorage.getItem('loaded_game'))
    show_game_info(set_load_sgf_handler.loaded_game)
    grec.loads(localStorage.getItem('game_record'))
    g_komi = JSON.parse(localStorage.getItem('komi'))
    if (localStorage.getItem('bot_active') == 'false') { bot_active('off') } else { bot_active('on') }
    $('#lb_komi').html(tr('Komi') + ': ' + g_komi)
    goto_move(grec.pos())
  } // load_state()

  //======================
  // Winning probability
  //======================

  // Get current winning probability from genmove
  //-------------------------------------------------------------
  function get_prob_genmove(completion, update_emo, playing) {
    set_status(tr('Counting ...'))
    axutil.hit_endpoint(fast_or_strong().ep + BOT,
      { 'board_size': BOARD_SIZE, 'moves': axutil.moves_only(grec.board_moves()), 'config': { 'komi': g_komi } },
      (data) => {
        get_prob_callback(data.diagnostics.winprob, data.diagnostics.score, update_emo, playing)
        if (completion) { completion(data) }
      })
  } // get_prob_genmove()

  // Continue after prob and score came back from the server
  //-------------------------------------------------------------------
  function get_prob_callback(winprob, score, update_emo, playing) {
    if (grec.pos()) {
      var p = Math.round(parseFloat(winprob) * 100) / 100
      var s = Math.round(parseFloat(score) * 100) / 100
      grec.update(p, s)
      if (settings('game_hash')) { // we are in an active game
        //console.log( 'saving ' + grec.pos() )
        grec.dbsave() // save and notify observers
      }
    }
    show_prob(update_emo, playing)
    if (g_click_coord_buffer) { // user clicked while waiting, do it now
      board_click_callback(g_click_coord_buffer)
      g_click_coord_buffer = null
    }
    else if (g_play_btn_buffer) { // Buffered play button click
      botmove_if_active()
      g_play_btn_buffer = false
    }
    else if (g_best_btn_buffer) { // Buffered play button click
      best_btn_callback()
      g_best_btn_buffer = false
    }
  } // get_prob_callback()

  // Get the best move
  //----------------------------------------------------------
  function get_best_move(completion, update_emo, playing) {
    set_status(tr('KataGo is thinking ...'))
    axutil.hit_endpoint(fast_or_strong().ep + BOT,
      { 'board_size': BOARD_SIZE, 'moves': axutil.moves_only(grec.board_moves()), 'config': { 'komi': g_komi } },
      (data) => {
        if (completion) { completion(data) }
      })
  } // get_best_move()

  //------------------------------------------
  function show_prob(update_emo, playing) {
    var cur = grec.curmove()
    if (cur) {
      var p = cur.p
      var score = cur.score
      // 0.8 -> 1.0; 1.3 -> 1.5 etc
      score = Math.trunc(Math.abs(score) * 2 + 0.5) * Math.sign(score) / 2.0
      if (playing && !settings('show_prob')) {
        clear_status()
      } else {
        var scorestr = get_scorestr(p, score)
        set_status(scorestr)
      }
      // Show emoji
      if (update_emo) { update_emoji() }
    } else {
      clear_status()
    }
  } // show_prob()

  const HAPPY_POINT_LOSS_MAX = 2.0
  //--------------------------------
  function update_emoji() {
    var cur = grec.curmove()
    var prev = grec.prevmove()
    if (!cur) { return }
    var p = cur.p
    var score = cur.score
    if (p == 0) { set_emoji(); return }
    if (prev) {
      if (cur.mv == 'pass') { set_emoji(); return }
      if (prev.mv == 'pass') { set_emoji(); return }
      if (prev.p == 0) { set_emoji(); return }
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
      else { set_emoji(delta_p, delta_score) }
    }
    else {
      set_emoji()
    }
  } // update_emoji()

  //-----------------------------------------------
  function set_emoji(delta_prob, delta_score) {
    var emo_id = '#emo'
    if (typeof delta_prob == 'undefined') {
      $(emo_id).html('&nbsp;')
      return
    }
    const MOVE_EMOJI = ['😍', '😐', '😓', '😡']
    var emo = MOVE_EMOJI[3]

    // Get angry if we lose winning probability
    const PROB_BINS = [0.03, 0.06, 0.1]
    var prob_idx
    for (prob_idx = 0; prob_idx < PROB_BINS.length; prob_idx++) {
      if (delta_prob < PROB_BINS[prob_idx]) break;
    }
    // Get angry if we lose points
    const SCORE_BINS = [HAPPY_POINT_LOSS_MAX, 4, 8]
    var score_idx
    for (score_idx = 0; score_idx < SCORE_BINS.length; score_idx++) {
      if (delta_score < SCORE_BINS[score_idx]) break;
    }

    // Choose whichever is angrier
    emo = MOVE_EMOJI[Math.max(prob_idx, score_idx)]
    $(emo_id).html(emo)
  } // set_emoji()

  //==========
  // Scoring
  //==========

  // Score the current position with katago.
  //-------------------------------------------
  function score_position() {
    set_status('Scoring...')
    axutil.hit_endpoint('/score/' + BOT,
      {
        'board_size': BOARD_SIZE, 'moves': axutil.moves_only(grec.board_moves()),
        'config': { 'komi': g_komi }, 'tt': Math.random()
      },
      (data) => {
        score_position.active = true
        score_position.probs = data.probs
        draw_estimate(data.probs)
        get_prob_genmove(function () { }, false, false)
      } // (data) =>
    ) // hit_endpoint()
  } // score_position()
  score_position.active = false
  score_position.probs = []

  // Draw black and white squares with alpha representing certainty
  //------------------------------------------------------------------
  function draw_estimate(probs) {
    var node = g_jrecord.createNode(true)
    for (const [idx, prob] of probs.entries()) {
      var row = BOARD_SIZE - Math.trunc(idx / BOARD_SIZE)
      var col = (idx % BOARD_SIZE) + 1

      var coord = axutil.rc2jcoord(row, col)
      var ncoord = axutil.rot_coord(coord) // rotate if needed

      if (prob < 0) { // white
        node.setMark(ncoord, 'WP:' + Math.trunc(Math.abs(prob) * 100))
      } // for
      else { // black
        node.setMark(ncoord, 'BP:' + Math.trunc(Math.abs(prob) * 100))
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
  function hover(coord, col, opts) {
    opts = opts || {}
    if (!opts.force) {
      if (p_options.mobile && col) { return }
    }
    var hcol = col ? col : turn()
    var jboard = g_jrecord.jboard
    if (jboard.getType(coord) == JGO.WHITE || jboard.getType(coord) == JGO.BLACK) { return }
    if (coord) {
      if (hover.coord) {
        jboard.setType(hover.coord, JGO.CLEAR)
      }
      jboard.setType(coord, hcol == JGO.WHITE ? JGO.DIM_WHITE : JGO.DIM_BLACK)
      hover.coord = coord
      if (col) {
        replay_moves(grec.pos()) // remove artifacts
        add_mark('redraw')
        jboard.setType(coord, hcol == JGO.WHITE ? JGO.DIM_WHITE : JGO.DIM_BLACK)
      }
    }
    else if (hover.coord) {
      jboard.setType(hover.coord, JGO.CLEAR)
      hover.coord = null
      replay_moves(grec.pos()) // remove artifacts
      add_mark('redraw')
    }
  } // hover()
  hover.coord = null

  // Get or set guest, fast, strong mode
  //---------------------------------------
  function fast_or_strong(val) {
    const MARFA_STRONG = { 'val': 'marfa_strong', 'ep': '/select-move-marfa-strong/', 'name': 'marfa_strong' }
    const STRONG = { 'val': 'strong', 'ep': '/select-move-x/', 'name': 'kata40' }
    //const FAST = { 'val': 'fast', 'ep': '/select-move/', 'name': 'kata20' }
    const GUEST = { 'val': 'guest', 'ep': '/select-move-guest/', 'name': 'kata10' }
    const ONE10 = { 'val': 'one10', 'ep': '/select-move-one10/', 'name': 'kata_one10' }
    if (typeof val == 'undefined') { // getter
      if ($('#username').html().indexOf('one10') >= 0) { // special user for 10b one playout 
        return fast_or_strong('one10')
      } else if ($('#btn_tgl_strong').hasClass('active')) {
        if ($('#username').html().trim() == 'acm') {
          return fast_or_strong('marfa_strong')
        } else {
          return fast_or_strong('strong')
        }
      } else if ($('#btn_tgl_fast').hasClass('active')) {
        return fast_or_strong('fast')
      } else {
        return fast_or_strong('guest')
      }
    } // if getter
    // setter
    if (val == 'toggle') {
      if (!settings('logged_in')) {
        return fast_or_strong('guest')
      } else if ($('#btn_tgl_strong').hasClass('active')) {
        return fast_or_strong('guest')
        //} else if ($('#btn_tgl_fast').hasClass('active')) {
        //  return fast_or_strong('strong')
      } else { // guest goes to strong
        return fast_or_strong('strong')
      }
    }
    else if (val == 'strong') {
      if (settings('logged_in')) {
        $('#descr_bot').html(`KataGo Pro 1000<br>${DDATE}`)
        $('#btn_tgl_strong').addClass('active')
        //$('#btn_tgl_fast').removeClass('active')
        $('#btn_tgl_guest').removeClass('active')
        $('#btn_bot').html('Kata Pro')
        axutil.set_attr('#img_bot', 'src', 'static/kata-red.png')
        return STRONG
      } // if logged in
      else {
        fast_or_strong('guest') // Strong is disabled
        var tstr = '<a href="/login" class="touch-allow">' + tr('Please Log In') + '</a>'
        $('#donate_modal').html(tstr)
      }
    }
    else if (val == 'marfa_strong') {
      if (settings('logged_in')) {
        $('#descr_bot').html(`Marfa<br>${DDATE}`)
        $('#btn_tgl_strong').addClass('active')
        //$('#btn_tgl_fast').removeClass('active')
        $('#btn_tgl_guest').removeClass('active')
        $('#btn_bot').html('Marfa')
        axutil.set_attr('#img_bot', 'src', 'static/kata-red.png')
        return MARFA_STRONG
      } // if logged in
      else {
        fast_or_strong('guest') // Strong is disabled
        var tstr = '<a href="/login" class="touch-allow">' + tr('Please Log In') + '</a>'
        $('#donate_modal').html(tstr)
      }
    }
    else if (val == 'one10') {
      $('#descr_bot').html(`KataGo 10b &nbsp; 16<br>${DDATE}`)
      $('#btn_tgl_guest').addClass('active')
      //$('#btn_tgl_fast').removeClass('active')
      $('#btn_tgl_strong').removeClass('active')
      $('#btn_bot').html('Kata 10b')
      axutil.set_attr('#img_bot', 'src', 'static/kata-gray.png')
      return ONE10
    }
    else { // val == guest
      $('#descr_bot').html(`KataGo 10b &nbsp; 256<br>${DDATE}`)
      $('#btn_tgl_guest').addClass('active')
      //$('#btn_tgl_fast').removeClass('active')
      $('#btn_tgl_strong').removeClass('active')
      $('#btn_bot').html('Kata 10b')
      axutil.set_attr('#img_bot', 'src', 'static/kata-gray.png')
      return GUEST
    }
    return 0
  } // fast_or_strong()

  // Translation function for Jinja templates
  function tr(text) { if (serverData) { return serverData.translate(text) } return text }

  // Save game record once a second
  function once_per_sec() {
    save_state()
    clearTimeout(once_per_sec.timer)
    once_per_sec.timer = setTimeout(once_per_sec, 5000)
  }
  once_per_sec.timer = null

  // Global vars
  var grec // The game record
  var serverData // Translation table and user info (e.g. their language)

  onRefresh()

  // Things that happen on page load and refresh
  //-----------------------------------------------
  function onRefresh() {
    grec = new GameRecord()
    settings()
    if (settings('diagrams')) {
      $('#diagram_buttons').show()
    } else {
      $('#diagram_buttons').hide()
    }

    set_btn_handlers()
    set_dropdown_handlers()
    reset_game()
    setup_jgo()
    selfplay('off')
    $('#btn_tgl_mark').click()
    document.onkeydown = check_key

    if (p_options.mobile) {
      window.onpagehide = save_state
    }
    else {
      window.onbeforeunload = save_state
    }

    var serverData = new ServerData(axutil, () => {
      load_state()
      get_handicap()
      once_per_sec()
    })
  } // onRefresh()

} // main()
