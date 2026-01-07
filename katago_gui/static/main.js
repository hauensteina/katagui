
/*
* Main entry point for katago-gui
* AHN Jan 2020
*/

'use strict';
import * as af from './appfuncs.js'
import { sgf2list } from './sgf.js'

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
function main(JGO, axutil) {
  const BOT = 'katago_gtp_bot'
  const BOARD_SIZE = 19

  $ = axutil.$
  const settings = axutil.settings
  var g_play_btn_buffer = false
  var g_best_btn_buffer = false

  //================
  // UI Callbacks
  //================

  //-----------------------------------
  function set_dropdown_handlers() {
    $('#komi_menu').html(af.g_komi)
    $('#komi_m505').click(function () { $('#komi_menu').html('-50.5') })
    $('#komi_m405').click(function () { $('#komi_menu').html('-40.5') })
    $('#komi_m305').click(function () { $('#komi_menu').html('-30.5') })
    $('#komi_m205').click(function () { $('#komi_menu').html('-20.5') })
    $('#komi_m105').click(function () { $('#komi_menu').html('-10.5') })
    $('#komi_05').click(function () { $('#komi_menu').html('0.5') })
    $('#komi_65').click(function () { $('#komi_menu').html('6.5') })
    $('#komi_75').click(function () { $('#komi_menu').html('7.5') })

    $('#handi_menu').html(af.g_handi)
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
      af.setHandi(parseInt($('#handi_menu').html()))
      af.setKomi(parseFloat($('#komi_menu').html()))
      reset_game()
      $('#lb_komi').html(tr('Komi') + ': ' + af.g_komi)
      af.clear_emoji()
      bot_active('on')
      af.clear_status()

      // create new game in db
      axutil.hit_endpoint_simple('/create_game', { 'handicap': af.g_handi, 'komi': af.g_komi },
        (resp) => {
          settings('game_hash', resp.game_hash)
          if (af.g_handi > 1) { botmove_if_active() }
        })
    })

    $('#cancel_new_game').click(function () { // New Game -> x
      $('#donate_modal').html('')
    })
  } // set_dropdown_handlers()


  //------------------------------------------
  function board_click_callback(coord) {
    selfplay('off')
    if (coord.i < 0 || coord.i > 18) { return }
    if (coord.j < 0 || coord.j > 18) { return }
    if (score_position.active) { goto_move(af.grec.pos()); return }

    if ($('#btn_tgl_add_black').hasClass('btn-success')) return add_stone(JGO.BLACK, coord)
    if ($('#btn_tgl_add_white').hasClass('btn-success')) return add_stone(JGO.WHITE, coord)
    if ($('#btn_tgl_number').hasClass('btn-success')) return af.add_mark(coord, 'number')
    if ($('#btn_tgl_letter').hasClass('btn-success')) return af.add_mark(coord, 'letter')
    if ($('#btn_tgl_x').hasClass('btn-success')) return af.add_mark(coord, 'X')
    if ($('#btn_tgl_triangle').hasClass('btn-success')) return af.add_mark(coord, 'triangle')
    if ($('#btn_tgl_circle').hasClass('btn-success')) return af.add_mark(coord, 'circle')

    var jboard = af.g_jrecord.jboard
    if ((jboard.getType(coord) == JGO.BLACK) || (jboard.getType(coord) == JGO.WHITE)) { return }
    if (axutil.hit_endpoint('waiting')) {
      board_click_callback.g_click_coord_buffer = coord
      return
    }
    // clear hover away
    af.hover()

    // Add the new move
    maybe_start_var()
    var mstr = axutil.jcoord2string(coord) // This rotates the move if necessary
    af.grec.push({ 'mv': mstr, 'p': '0.00', 'score': 0, 'agent': 'human' })
    //board_click_callback.illegal_move = false
    goto_move(af.grec.len())
    // Silently ignore illegal moves
    //if (board_click_callback.illegal_move) {
    //  af.grec.pop()
    //  goto_move(af.grec.len())
    //  return
    //}
    if (settings('disable_ai')) { return }

    af.add_mark('redraw')
    af.clear_emoji()
    var greclen = af.grec.len()
    const playing = true
    var pos = af.grec.pos()
    af.set_status(tr('KataGo is thinking ...'))
    get_prob_genmove(
      (data) => {
        if (pos != af.grec.pos()) return
        af.grec.curmove().data = data
        if (bot_active() && (greclen == af.grec.len())) { bot_move_callback(data) }
        if (!bot_active() && settings('show_best_moves')) { af.show_best_moves(data) }
      },
      settings('show_emoji'), playing)
  } // board_click_callback()
  //board_click_callback.illegal_move = false
  board_click_callback.g_click_coord_buffer = null

  // Add a stone in diagram mode
  //-----------------------------------
  function add_stone(color, coord) {
    if (coord.i < 0 || coord.i > 18) return // invalid coord
    var jboard = af.g_jrecord.jboard
    maybe_start_var()

    // If the coord is already occupied, remove the stone by replacing it with a pass.
    if (jboard.getType(coord) == JGO.BLACK || jboard.getType(coord) == JGO.WHITE) {
      var move = af.grec.move_at_coord(coord)
      if (!move) { return }
      move.mv = 'pass'
      af.grec.remove_pass_pairs()
      af.replay_moves(af.grec.pos())
      if (color == JGO.BLACK) af.grec.force_black_turn()
      else if (color == JGO.WHITE) af.grec.force_white_turn()
      return
    }

    if (color == JGO.BLACK) af.grec.force_black_turn()
    else if (color == JGO.WHITE) af.grec.force_white_turn()

    var mstr = axutil.jcoord2string(coord) // This rotates the move if necessary
    af.grec.push({ 'mv': mstr, 'p': '0.00', 'score': '0.00', 'agent': 'human' })
    //board_click_callback.illegal_move = false
    //goto_move(af.grec.len())
    // Silently ignore illegal moves
    // if (board_click_callback.illegal_move) {
    //   af.grec.pop()
    //   goto_move(af.grec.len())
    //   return
    // }
    // Add a pass to get the right hover color
    af.grec.push({ 'mv': 'pass', 'p': '0.00', 'score': '0.00', 'agent': 'human' })
    //goto_move(af.grec.len())
    af.replay_moves(af.grec.pos())
  } // add_stone()

  //-------------------------------
  function best_btn_callback() {
    selfplay('off')
    af.set_status(tr('KataGo is thinking ...'))
    best_btn_callback.active = true
    get_best_move((data) => {
      var best_btn_flag = true
      af.show_best_moves(data, best_btn_flag)
    })
  } // best_btn_callback()
  best_btn_callback.active = false

  // Black moves at the beginning are handicap
  //--------------------------------------------
  function get_handicap() {
    af.setHandi(0)
    var handi = 0
    //if (af.grec.setup_stone_flag) { return g_handi }
    var rec = af.grec.prefix(20)
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
      af.setHandi(handi)
    }
    return af.g_handi
  } // get_handicap()

  //-------------------------
  function setup_jgo() {
    var moveCoord = ''
    var jsetup = new JGO.Setup(af.g_jrecord.jboard, JGO.BOARD.largeWalnut)
    jsetup.setOptions({ stars: { points: 9 } })
    // Add mouse event listeners for the board
    //------------------------------------------
    jsetup.create('board',
      function (canvas) {
        //----------------------------
        canvas.addListener('click',
          function (coord, ev) {
            if (axutil.isMobile()) return
            console.log('board_click')
            board_click_callback(coord)
          })

        //-------------------------------
        canvas.addListener('mousemove',
          function (coord, ev) {
            if (axutil.isMobile()) return
            console.log('mousemove')
            mouseMoveHandler(coord)
          }
        ) // mousemove

        //---------------------------------------------------------
        canvas.ctx.canvas.addEventListener("touchmove", (e) => {
          console.log('touchmove')
          const t = e.touches[0]
          var coord = canvas.getCoordinate(t.clientX, t.clientY)
          mouseMoveHandler(coord)
          moveCoord = coord
        }, { passive: true });

        //---------------------------------------------------------
        canvas.ctx.canvas.addEventListener("touchend", (e) => {
          if (!moveCoord) return
          console.log(`touchend ${moveCoord}`)
          var coord = moveCoord
          moveCoord = ''
          board_click_callback(coord)
        }, { passive: true });

        //-------------------------------------
        function mouseMoveHandler(coord) {
          if (coord.i == -1 || coord.j == -1)
            return
          if (coord == af.hover.coord)
            return

          af.hover(coord, af.turn(), {force:true})
          if (score_position.active) {
            draw_estimate(score_position.probs)
          }
          else if (best_btn_callback.active) {
            af.show_best_moves()
          }
          else if (is_markup_active()) {
            // do nothing
          }
          else if (af.grec.curmove() && af.grec.curmove().data) {
            if (settings('show_best_moves')) {
              af.show_best_curmoves()
            }
          }
        } // mouseMoveHandler()

        //----------------------------
        canvas.addListener('mouseout',
          function (ev) {
            af.hover()
            if (score_position.active) {
              draw_estimate(score_position.probs)
            }
            else if (best_btn_callback.active) {
              af.show_best_moves()
            }
            else if (is_markup_active()) {
              // do nothing
            }
            else if (af.grec.curmove() && af.grec.curmove().data) {
              if (settings('show_best_moves')) {
                af.show_best_curmoves()
              }
            }
          }
        ) // mouseout
      } // function(canvas)
    ) // create board
  } // setup_jgo()

  //------------------------------------
  function is_markup_active() {
    return $('#btn_tgl_number').hasClass('btn-success')
      || $('#btn_tgl_letter').hasClass('btn-success')
      || $('#btn_tgl_x').hasClass('btn-success')
      || $('#btn_tgl_triangle').hasClass('btn-success')
      || $('#btn_tgl_circle').hasClass('btn-success')
  } // is_markup_active()

  //----------------------------------------
  function deactivate_mark_toggles() {
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
  } // deactivate_mark_toggles()

  //------------------------------------------------
  function deactivate_add_black_add_white() {
    $('#btn_tgl_add_black').removeClass('btn-success')
    $('#btn_tgl_add_black').css('background-color', '')
    $('#btn_tgl_add_white').removeClass('btn-success')
    $('#btn_tgl_add_white').css('background-color', '')
  } // deactivate_add_black_add_white()

  // Set button callbacks
  //------------------------------
  function set_btn_handlers() {
    set_load_sgf_handler()
    var_button_state('off')

    function activate_mark_toggle(btn) {
      var wasoff = 1
      if (btn.hasClass('btn-success')) wasoff = 0
      deactivate_mark_toggles()
      if (wasoff) {
        btn.addClass('btn-success')
        btn.css('background-color', 'green')
        deactivate_add_black_add_white()
      }
      af.replay_all_moves()
      af.add_mark('redraw')
    } // activate_mark_toggle()

    $('#btn_movenum').click(() => {
      goto_next_bad_move(0.1)
    })

    $('#btn_tgl_add_black').click(() => {
      var bbtn = $('#btn_tgl_add_black')
      var wbtn = $('#btn_tgl_add_white')
      var wasoff = 1
      if (bbtn.hasClass('btn-success')) wasoff = 0
      if (wasoff) {
        deactivate_mark_toggles()
        bbtn.addClass('btn-success')
        bbtn.css('background-color', 'green')
        wbtn.removeClass('btn-success')
        wbtn.css('background-color', '')
        maybe_start_var()
        af.grec.force_black_turn()
        af.replay_all_moves()
      } else {
        bbtn.removeClass('btn-success')
        bbtn.css('background-color', '')
        af.grec.force_white_turn()
        af.replay_all_moves()
      }
    }) // btn_add_black.click()

    $('#btn_tgl_add_white').click(() => {
      var bbtn = $('#btn_tgl_add_black')
      var wbtn = $('#btn_tgl_add_white')
      var wasoff = 1
      if (wbtn.hasClass('btn-success')) wasoff = 0
      if (wasoff) {
        deactivate_mark_toggles()
        wbtn.addClass('btn-success')
        wbtn.css('background-color', 'green')
        bbtn.removeClass('btn-success')
        bbtn.css('background-color', '')
        maybe_start_var()
        af.grec.force_white_turn()
        af.replay_all_moves()
      } else {
        wbtn.removeClass('btn-success')
        wbtn.css('background-color', '')
        af.grec.force_black_turn()
        af.replay_all_moves()
      }
    }) // btn_add_white.click()

    $('#btn_tgl_number').click(() => {
      activate_mark_toggle($('#btn_tgl_number'))
    })

    $('#btn_tgl_letter').click(() => {
      activate_mark_toggle($('#btn_tgl_letter'))
    })

    $('#btn_tgl_rot').click(() => {
      var btn = $('#btn_tgl_rot')
      var rot = (axutil.getRotation() + 1) % 8
      axutil.setRotation(rot)
      af.replay_moves(af.grec.pos())
      af.add_mark('redraw')
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
      if (af.show_move.swap_colors) {
        af.swap_colors(false)
        af.replay_moves(af.grec.pos())
        af.add_mark('redraw')
        btn.removeClass('btn-success')
        btn.css('background-color', '')
      } else {
        af.swap_colors(true)
        af.replay_moves(af.grec.pos())
        af.add_mark('redraw')
        btn.addClass('btn-success')
        btn.css('background-color', 'green')
      }
    }) // btn_tgl_swap_colors

    $('#btn_export_diagram').click(() => {
      let node = af.g_jrecord.getCurrentNode()
      let marks = JSON.stringify(node.jboard.marks)
      let stones = JSON.stringify(node.jboard.stones)
      var rec = axutil.moves_only(af.grec.all_moves())
      // kludge to manage passes
      for (var i = 0; i < rec.length; i++) {
        if (rec[i] == 'pass') { rec[i] = 'A0' }
      }
      var moves = rec.join('')
      var meta = set_load_sgf_handler.loaded_game
      if (!meta) {
        meta = {}
        meta.komi = af.g_komi
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
      af.add_mark('clear')
      deactivate_mark_toggles()
    })

    $('#img_bot, #descr_bot').click(() => {
      selfplay('off')
      fast_or_strong('toggle')
    })

    $('#btn_tgl_guest').click(() => {
      fast_or_strong('guest')
    })

    $('#btn_tgl_strong').click(() => {
      fast_or_strong('strong')
    })

    $('#btn_clear_var').click(() => {
      selfplay('off')
      if ($('#btn_clear_var').hasClass('disabled')) { return }
      handle_variation('clear')
      if (settings('game_hash')) { // we are in an active game
        af.grec.dbsave() // save and notify observers
      }
    })

    $('#btn_watch').click(() => {
      if (axutil.isMobile()) {
        location.href = 'watch_select_game_mobile'
      } else {
        location.href = 'watch_select_game'
      }
    })

    $('#btn_play').click(() => {
      selfplay('off')
      af.clear_emoji()
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
      var moves = axutil.moves_only(af.grec.all_moves())
      var probs = axutil.probs_only(af.grec.all_moves())
      var scores = axutil.scores_only(af.grec.all_moves())
      for (var i = 0; i < probs.length; i++) { probs[i] = probs[i] ? probs[i].toFixed(2) : '0.00' }
      for (var i = 0; i < scores.length; i++) { scores[i] = scores[i] ? scores[i].toFixed(1) : '0.00' }
      // Kludge to manage passes
      for (var i = 0; i < moves.length; i++) {
        if (moves[i] == 'pass') { moves[i] = 'A0' }
      }
      if (moves.length == 0) { return }
      var meta = set_load_sgf_handler.loaded_game
      if (!meta) {
        meta = {}
        meta.komi = af.g_komi
      }
      var sgf = af.moves2sgf(moves, probs, scores, meta)
      af.downloadSgf('game.sgf', sgf)
    })

    $('#btn_nnscore').click(() => {
      selfplay('off')
      if (score_position.active) {
        goto_move(af.grec.pos())
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
      if (score_position.active) { goto_move(af.grec.pos()); return }
      maybe_start_var()
      af.grec.push({ 'mv': 'pass', 'p': 0, 'score': 0, 'agent': 'human' })
      goto_move(af.grec.len())
      botmove_if_active()
    })

    $('#btn_undo').click(() => {
      selfplay('off')
      axutil.hit_endpoint('cancel')
      var at_end = (af.grec.pos() == af.grec.len())
      goto_move(af.grec.pos() - 1); af.update_emoji(); bot_active('off')
      if (at_end) {
        af.grec.truncate()
        if (settings('game_hash')) { // we are in an active game
          af.grec.dbsave() // save and notify observers
        }
      }
      af.show_movenum()
    })

    $('#btn_prev').click(btn_prev)
    $('#btn_next').click(btn_next)
    $('#btn_back10').click(() => { selfplay('off'); goto_move(af.grec.pos() - 10); af.update_emoji(); bot_active('off'); af.clear_status(); af.add_mark('redraw') })
    $('#btn_fwd10').click(() => { selfplay('off'); goto_move(af.grec.pos() + 10); af.update_emoji(); bot_active('off'); af.clear_status(); af.add_mark('redraw') })
    $('#btn_first').click(() => { selfplay('off'); goto_move(0); af.clear_emoji(); bot_active('off'); af.clear_status(); af.add_mark('clear') })
    $('#btn_last').click(() => { selfplay('off'); goto_move(af.grec.len()); af.update_emoji(); bot_active('off'); af.clear_status(); af.add_mark('redraw') })

    $('#btn_settings').click(() => {
      af.initSettingSliders()
      $('#div_settings').css({ 'display': 'grid' })
    })

    $('#btn_settings1').click(() => {
      af.initSettingSliders()
      $('#div_settings').css({ 'display': 'grid' })
    })

    // Prevent zoom on double tap
    $('*').on('touchend', (e) => {
      // Exceptions
      if (e.target.name == 'submit') { return }
      if (e.target.localName == 'canvas') { return }
      //if (e.target.className.includes('modal')) { window.alert(e.target.id); return }
      if (e.target.className.includes('btn-file')) { return }
      if (e.target.className.includes('touch-allow')) { return }
      if (e.target.className.includes('btn-primary')) { return }
      if (e.target.className.includes('btn-outline-dark')) { return }
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
          $(e.target).css('background-color', '')
        }, 100)
      }
    })
  } // set_btn_handlers()

  // Start and stop selfplay
  //--------------------------
  function selfplay(action) {
    if (action == 'on') {
      cb_selfplay.saved_data = null
      //$('#btn_tgl_selfplay').css('color', 'black')
      $('#btn_tgl_selfplay').css('background-color', '#2c9d45')
      fast_or_strong('fast')
      selfplay.ready = true
      return $('#btn_tgl_selfplay').addClass('btn-success')
    }
    else if (action == 'off') {
      clearTimeout(selfplay.timer)
      //$('#btn_tgl_selfplay').css('color', 'black') // @@@
      $('#btn_tgl_selfplay').css('background-color', '')
      return $('#btn_tgl_selfplay').removeClass('btn-success')
    }
    else if (action == 'ison') {
      return $('#btn_tgl_selfplay').hasClass('btn-success')
    }

    // action == 'toggle'
    if (selfplay('ison')) {
      //$('#btn_tgl_selfplay').css('background-color', '#c0d0c0')
      return selfplay('off')
    }
    selfplay('on')
    var interval = 6500
    if (settings('selfplay_speed')) {
      if (settings('selfplay_speed') == 'fast') { interval = 4000 }
      else if (settings('selfplay_speed') == 'slow') { interval = 8000 }
    }
    // acm user analyzes as fast as possible
    if ($('#username').html().trim() == 'acm' && settings('selfplay_speed') == 'fast') {
      interval = 20
    }
    cb_selfplay(interval)
    return 0
  } // selfplay()
  selfplay.ready = true
  selfplay.timer = null

  //--------------------------------------------
  function start_selfplay_timer(interval) {
    if (selfplay('ison')) {
      selfplay.timer = setTimeout(() => { cb_selfplay(interval) }, interval)
    }
  } // reset_selfplay_timer()

  // Timer callback for selfplay
  //---------------------------------
  function cb_selfplay(interval) {
    console.log(interval)
    clearTimeout(selfplay.timer)
    if (document.visibilityState != 'visible') return
    //set_emoji()
    if (!selfplay.ready) return
    selfplay.ready = false

    // Replaying existing game. Check whether there is a next move
    if (af.grec.pos() < af.grec.len()) {
      replay_loaded_game(interval); return;
    }

    // Game over
    if (af.grec.curmove() && af.grec.curmove().mv == 'pass') {
      axutil.popup('Selfplay game over.')
      selfplay('off')
      return
    }

    // Continue game
    var ep = fast_or_strong('fast').ep
    if ($('#username').html().trim() == 'acm') {
      ep = fast_or_strong('marfa_strong').ep
    }
    // We show the previous move but also need the next one to mark best continuation moves A,B,C,...
    if (!cb_selfplay.saved_data) {
      console.log('cb_selfplay(): init saved data')
      axutil.hit_endpoint(ep + BOT,
        { 'board_size': BOARD_SIZE, 'moves': axutil.moves_only(af.grec.board_moves()), 'config': { 'komi': af.g_komi }, 'selfplay': 1 },
        (data) => {
          cb_selfplay.saved_data = data
          selfplay.ready = true
          cb_selfplay(interval)
        }
      )
      return
    } // if (!cb_selfplay.saved_data) 

    // Show the saved move
    maybe_start_var()
    af.grec.push({ 'mv': cb_selfplay.saved_data.bot_move, 'p': 0, 'score': 0, 'agent': 'kata20' })
    af.replay_moves(af.grec.pos())
    const playing = true
    get_prob_callback(cb_selfplay.saved_data.diagnostics.winprob, cb_selfplay.saved_data.diagnostics.score, settings('show_emoji'), playing)

    // Get next move and save it. Show best ten.
    axutil.hit_endpoint(ep + BOT,
      { 'board_size': BOARD_SIZE, 'moves': axutil.moves_only(af.grec.board_moves()), 'config': { 'komi': af.g_komi }, 'selfplay': 1 },
      (data) => {
        selfplay.ready = true
        cb_selfplay.saved_data = data
        af.grec.curmove().data = data
        if (!selfplay('ison')) return
        if (settings('show_best_moves') && interval > 1000) { af.show_best_moves(cb_selfplay.saved_data) }
        start_selfplay_timer(interval)
      }) // hit_endpoint()
  } // cb_selfplay()
  cb_selfplay.saved_data = null

  // cb_selfplay() calls this if we're self-playing a loaded sgf
  //---------------------------------------------------------------
  function replay_loaded_game(interval) {
    if (!selfplay('ison')) return;
    af.grec.step()
    if (af.grec.curmove() && af.grec.curmove().p === '0.00') { // No cached winprob, get it from katago
      console.log('getting prob')
      get_prob_genmove((data) => {
        selfplay.ready = true
        af.grec.curmove().data = data
        goto_move(af.grec.pos())
        af.update_emoji()
        if (settings('show_best_moves')) { af.show_best_curmoves() }
        start_selfplay_timer(interval)
      })
    }
    else { // Cached winprob
      console.log('using cached prob')
      selfplay.ready = true
      goto_move(af.grec.pos())
      af.update_emoji()
      if (settings('show_best_moves')) { af.show_best_curmoves() }
      start_selfplay_timer(interval)
    }
    if (af.grec.pos() >= af.grec.len()) {
      axutil.popup('Game replay complete.')
      selfplay('off')
    }
  } // replay_loaded_game()

  // Load Sgf button
  //-----------------------------------
  function set_load_sgf_handler() {
    $('#sgf-file').on('change', async function () {
      var input = $(this)
      var fname = input.val().replace(/\\/g, '/').replace(/.*\//, '')
      var myfile = input.get(0).files[0]
      const sgf = await axutil.readFileAsText(myfile)
      var game = sgf2list(sgf)
      game.fname = fname

      var moves = game.moves
      $('#lb_komi').html(tr('Komi') + ': ' + game.komi)
      handle_variation('clear')
      af.clear_emoji()
      end_game()
      af.newGrec()
      for (var move of moves) {
        var move_prob = { 'mv': move, 'p': '0.00', 'score': '0.00', 'agent': '' }
        af.grec.push(move_prob)
      } // for
      af.add_mark('clear')
      deactivate_mark_toggles()
      deactivate_add_black_add_white()
      af.replay_moves(af.grec.pos())
      af.show_movenum()
      af.setKomi(game.komi)
      get_handicap()
      show_game_info(game)
      af.clear_status()
      set_load_sgf_handler.loaded_game = game
      $('#sgf-file').val('') // reset to make sure it triggers again

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
    if (!af.grec.len()) return
    if (axutil.hit_endpoint('waiting')) return // this prevents p and score being written to the wrong move
    goto_move(af.grec.pos() - 1); af.update_emoji(); bot_active('off')
    af.add_mark('redraw')

    if (af.grec.curmove() && af.grec.curmove().data) {
      if (settings('show_best_moves')) { af.show_best_curmoves() }
    }
  } // btn_prev()

  //-------------------------
  function btn_next() {
    selfplay('off');
    if (!af.grec.len()) return
    if (btn_next.waiting) {
      btn_next.buffered = true;
      console.log('btn_next buffered');  // wait for the previous call to finish
      return
    }
    console.log('btn_next()')
    goto_move(af.grec.pos() + 1)
    af.add_mark('redraw')
    // Do not analyze handicap stones
    if (af.grec.pos() < 20 && af.grec.len() > af.grec.pos() && af.grec.nextmove().mv == 'pass') {
      goto_move(af.grec.pos() + 1)
      return
    }
    if (settings('disable_ai')) { return }

    if (af.grec.curmove() && af.grec.curmove().data) {
      if (settings('show_best_moves')) { af.show_best_curmoves() }
    }
    else {
      btn_next.waiting = true
      console.log('btn_next waiting')
      af.set_status(tr('KataGo is thinking ...'))
      var pos = af.grec.pos()
      get_prob_genmove((data) => {
        btn_next.waiting = false
        console.log('btn_next waiting cleared')
        if (pos != af.grec.pos()) return
        af.grec.curmove().data = data
        af.update_emoji()
        if (settings('show_best_moves')) {
          af.show_best_moves(data)
        }
        bot_active('off')
        if (btn_next.buffered) {
          btn_next.buffered = false
          console.log('btn_next() 2')
          btn_next()
        }
      })
      return
    } // else
    af.update_emoji()
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


  //===================
  // Bot Interaction
  //===================

  //-----------------------------
  function get_katago_move() {
    af.set_status(tr('KataGo is thinking ...'))
    var greclen = af.grec.len()
    axutil.hit_endpoint(fast_or_strong().ep + BOT, {
      'board_size': BOARD_SIZE, 'moves': axutil.moves_only(af.grec.board_moves()),
      'config': { 'komi': af.g_komi }
    },
      (data) => {
        if (greclen == af.grec.len()) { // user did not click in the meantime
          // if (settings('play_a')) {
          //   data.bot_move = data.diagnostics.best_ten[0].move
          // }
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
    af.hover() // The board thinks the hover stone is actually there. Clear it.
    var botprob = data.diagnostics.winprob; var botcol = 'Black'
    if (af.turn() == JGO.WHITE) { botprob = 1.0 - botprob; botcol = 'White' }

    if (data.bot_move == 'pass') {
      alert(tr('KataGo passes. Click on the Score button.'))
      af.clear_status()
    }
    else if (data.bot_move == 'resign') {
      alert(tr('KataGo resigns.'))
      af.set_status(tr('KataGo resigns.'))
      return
    }
    else if ((var_button_state() == 'off') && (af.grec.pos() > 150) && ( // do not resign in variation or too early
      (af.g_handi < 3 && botprob < 0.01) ||
      (af.g_handi < 2 && botprob < 0.02) ||
      (botprob < 0.001))
      && (data.diagnostics.score > 10.0) // Do not resign unless B has a 10 point lead
    ) {
      alert(tr('KataGo resigns. You beat KataGo!'))
      af.set_status(tr('KataGo resigns.'))
      return
    }
    else {
      maybe_start_var()
    }
    af.grec.push({ 'mv': data.bot_move, 'p': 0.0, 'score': 0.0, 'agent': fast_or_strong().name })
    af.replay_moves(af.grec.pos())
    af.show_movenum()
    af.add_mark('redraw')
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
      if (axutil.settings('disable_ai')) { return }
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

  //-----------------------
  function reset_game() {
    handle_variation('clear')
    set_load_sgf_handler.loaded_game = null
    show_game_info() // clear
    af.newGrec()
    af.goto_first_move()
    if (af.g_handi < 2) { return }
    var hstones = HANDISTONES[af.g_handi]
    for (const [idx, s] of hstones.entries()) {
      if (idx > 0) {
        af.grec.push({ 'mv': 'pass', 'p': 0, 'score': 0, 'agent': '' })
      }
      af.grec.push({ 'mv': s, 'p': 0, 'score': 0, 'agent': '' })
    }
    goto_move(af.grec.len())
  } // reset_game()

  // The active game has ended.
  //----------------------------
  function end_game() {
    settings('game_hash', '')
  } // end_game()


  // Replay and show game up to move n
  //-------------------------------------
  function goto_move(n) {
    if (n == 0) { end_game() }
    n = Math.max(n, 2 * af.g_handi - 1)
    score_position.active = false
    best_btn_callback.active = false
    var totmoves = af.grec.len()
    if (n > totmoves) { n = totmoves }
    if (n < 1) { af.goto_first_move(); af.clear_emoji(); return }
    af.replay_moves(n)
    af.show_movenum()
    af.show_prob()
  } // goto_move()

  //======================
  // Variation handling
  //======================

  // Make a variation, or restore from var, or forget var
  //--------------------------------------------------------
  function handle_variation(action) {
    if (action == 'save') { // Save record and start a variation
      af.grec.enter_var()
      var_button_state('on')
    }
    else if (action == 'clear') { // Restore game record and forget the variation
      af.grec.exit_var()
      goto_move(af.grec.pos())
      af.update_emoji(); bot_active('off')
      var_button_state('off')
      af.clear_status()
    }
  } // handle_variation()

  // Start a variation if we're not at the end
  //---------------------------------------------
  function maybe_start_var() {
    if (af.grec.len() && af.grec.pos() < af.grec.len()) {
      handle_variation('save')
    }
  } // maybe_start_var()

  //---------------------------------------
  function var_button_state(state) {
    if (!state) {
      return $('#btn_clear_var').hasClass('btn-on') ? 'on' : 'off'
    }

    if (state === 'on') {
      $('#btn_clear_var').addClass('btn-success btn-on');
      axutil.enable_button('btn_clear_var')
    } else {
      $('#btn_clear_var').removeClass('btn-success btn-on')
      deactivate_add_black_add_white()
      deactivate_mark_toggles()
      af.add_mark('clear')
      axutil.disable_button('btn_clear_var')
    }
    return 0
  } // var_button_state()


  //===============================
  // Saving and restoring state
  //===============================

  //--------------------------
  function save_state() {
    localStorage.setItem('fast_or_strong', fast_or_strong().val)
    //if (var_button_state() == 'off') { // don't save if in variation
    localStorage.setItem('game_record', af.grec.dumps())
    localStorage.setItem('komi', JSON.stringify(af.g_komi))
    localStorage.setItem('bot_active', bot_active())
    localStorage.setItem('loaded_game', JSON.stringify(set_load_sgf_handler.loaded_game))
    //}
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
    af.grec.loads(localStorage.getItem('game_record'))
    if (af.grec.var_active()) {
      var_button_state('on')
    }
    af.setKomi(JSON.parse(localStorage.getItem('komi')))
    if (localStorage.getItem('bot_active') == 'false') { bot_active('off') } else { bot_active('on') }
    $('#lb_komi').html(tr('Komi') + ': ' + af.g_komi)
    goto_move(af.grec.pos())
  } // load_state()

  //======================
  // Winning probability
  //======================

  // Get current winning probability from genmove
  //-------------------------------------------------------------
  function get_prob_genmove(completion, update_emo, playing) {
    //af.set_status(tr('Counting ...'))
    axutil.hit_endpoint(fast_or_strong().ep + BOT,
      { 'board_size': BOARD_SIZE, 'moves': axutil.moves_only(af.grec.board_moves()), 'config': { 'komi': af.g_komi } },
      (data) => {
        get_prob_callback(data.diagnostics.winprob, data.diagnostics.score, update_emo, playing)
        if (completion) { completion(data) }
      })
  } // get_prob_genmove()

  // Continue after prob and score came back from the server
  //-------------------------------------------------------------------
  function get_prob_callback(winprob, score, update_emo, playing) {
    if (af.grec.pos()) {
      var p = Math.round(parseFloat(winprob) * 100) / 100
      var s = Math.round(parseFloat(score) * 100) / 100
      af.grec.update(p, s)
      if (settings('game_hash')) { // we are in an active game
        //console.log( 'saving ' + af.grec.pos() )
        af.grec.dbsave() // save and notify observers
      }
    }
    af.show_prob(update_emo, playing)
    if (board_click_callback.g_click_coord_buffer) { // user clicked while waiting, do it now
      board_click_callback(board_click_callback.g_click_coord_buffer)
      board_click_callback.g_click_coord_buffer = null
    }
    else if (g_play_btn_buffer) { // Buffered play button click
      botmove_if_active()
      g_play_btn_buffer = false
    }
    else if (g_best_btn_buffer) { // Buffered best button click
      best_btn_callback()
      g_best_btn_buffer = false
    }
  } // get_prob_callback()

  // Get the best move
  //----------------------------------------------------------
  function get_best_move(completion, update_emo, playing) {
    af.set_status(tr('KataGo is thinking ...'))
    axutil.hit_endpoint(fast_or_strong().ep + BOT,
      { 'board_size': BOARD_SIZE, 'moves': axutil.moves_only(af.grec.board_moves()), 'config': { 'komi': af.g_komi } },
      (data) => {
        if (completion) { completion(data) }
      })
  } // get_best_move()

  //==========
  // Scoring
  //==========

  // Score the current position with katago.
  //-------------------------------------------
  function score_position() {
    af.set_status('Scoring...')
    axutil.hit_endpoint('/score/' + BOT,
      {
        'board_size': BOARD_SIZE, 'moves': axutil.moves_only(af.grec.board_moves()),
        'config': { 'komi': af.g_komi }, 'tt': Math.random()
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
    var node = af.g_jrecord.createNode(true)
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


  // Get or set guest, fast, strong mode
  //---------------------------------------
  function fast_or_strong(val) {
    const MARFA_STRONG = { 'val': 'marfa_strong', 'ep': '/select-move-marfa-strong/', 'name': 'marfa_strong' }
    const MARFA_XSTRONG = { 'val': 'marfa_xstrong', 'ep': '/select-move-marfa-xstrong/', 'name': 'marfa_xstrong' }
    const STRONG = { 'val': 'strong', 'ep': '/select-move-x/', 'name': 'kata40' }
    //const FAST = { 'val': 'fast', 'ep': '/select-move/', 'name': 'kata20' }
    const GUEST = { 'val': 'guest', 'ep': '/select-move-guest/', 'name': 'kata10' }
    const ONE10 = { 'val': 'one10', 'ep': '/select-move-one10/', 'name': 'kata_one10' }
    if (typeof val == 'undefined') { // getter
      if ($('#username').html().indexOf('one10') >= 0) { // special user for 10b one playout 
        return fast_or_strong('one10')
      } else if ($('#btn_tgl_strong').hasClass('active')) {
        if ($('#username').html().trim() == 'acm') {
          return fast_or_strong('marfa_xstrong')
        } else {
          return fast_or_strong('strong')
        }
      } else {
        if ($('#username').html().trim() == 'acm') {
          return fast_or_strong('marfa_strong')
        } else {
          return fast_or_strong('guest')
        }
      }
    } // getter
    // setter
    if (val == 'toggle') {
      if (!settings('logged_in')) {
        return fast_or_strong('guest')
      } else if ($('#btn_tgl_strong').hasClass('active')) {
        return fast_or_strong('guest')
      } else { // guest goes to strong
        return fast_or_strong('strong')
      }
    }
    else if (val == 'strong') {
      if (settings('logged_in')) {
        if ($('#username').html().trim() == 'acm') { return fast_or_strong('marfa_xstrong') }
        $('#descr_bot').html(`KataGo Pro 1000`)
        $('#btn_tgl_strong').addClass('active')
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
      $('#descr_bot').html(`MarfaX<br>${DDATE}`)
      $('#btn_tgl_strong').removeClass('active')
      $('#btn_tgl_guest').addClass('active')
      $('#btn_bot').html('MarfaX')
      axutil.set_attr('#img_bot', 'src', 'static/kata-gray.png')
      return MARFA_STRONG
    }
    else if (val == 'marfa_xstrong') {
      $('#descr_bot').html(`MarfaXX<br>${DDATE}`)
      $('#btn_tgl_strong').addClass('active')
      $('#btn_tgl_guest').removeClass('active')
      $('#btn_bot').html('MarfaXX')
      axutil.set_attr('#img_bot', 'src', 'static/kata-red.png')
      return MARFA_XSTRONG
    }
    else if (val == 'one10') {
      $('#descr_bot').html(`KataGo 10b &nbsp; 16<br>${DDATE}`)
      $('#btn_tgl_guest').addClass('active')
      $('#btn_tgl_strong').removeClass('active')
      $('#btn_bot').html('Kata 10b')
      axutil.set_attr('#img_bot', 'src', 'static/kata-gray.png')
      return ONE10
    }
    else { // val == guest
      if ($('#username').html().trim() == 'acm') { return fast_or_strong('marfa_strong') }
      $('#descr_bot').html(`KataGo 10b 256`)
      $('#btn_tgl_guest').addClass('active')
      $('#btn_tgl_strong').removeClass('active')
      $('#btn_bot').html('Kata 10b')
      axutil.set_attr('#img_bot', 'src', 'static/kata-gray.png')
      return GUEST
    }
    return 0
  } // fast_or_strong()

  // This never worked and no complaints. Now it's a dummy.
  function tr(text) { return text }

  // Occasionally save game record 
  //-----------------------------------
  function periodicSave() {
    save_state()
    clearTimeout(periodicSave.timer)
    periodicSave.timer = setTimeout(periodicSave, 5000)
  } // periodicSave()
  periodicSave.timer = null

  // Global vars
  // var grec // The game record
  //var serverData // Translation table and user info (e.g. their language)

  onRefresh()

  // Things that happen on page load and refresh
  //-----------------------------------------------
  function onRefresh() {
    af.newGrec()
    settings()
    if (settings('diagrams')) {
      $('#diagram_buttons').show()
    } else {
      $('#diagram_buttons').hide()
    }

    af.toggle_ai_buttons({})

    set_btn_handlers()
    set_dropdown_handlers()
    reset_game()
    setup_jgo()
    selfplay('off')

    //    document.onkeydown = check_key
    document.addEventListener('keydown', check_key)

    if (axutil.isMobile()) {
      window.onpagehide = save_state
    }
    else {
      window.onbeforeunload = save_state
    }

    load_state()
    get_handicap()
    periodicSave()

    if (!settings('logged_in')) {
      axutil.disable_button('btn_tgl_selfplay')
    }
  } // onRefresh()

  //-----------------------------------------
  function goto_next_bad_move(thresh) {
    af.grec.seek_next_bad_move(thresh)
    goto_move(af.grec.pos())
    af.update_emoji()
    if (settings('show_best_moves')) { af.show_best_curmoves() }
  } // goto_next_bad_move()

  // Key actions
  //------------------------
  function check_key(e) {
    if (!e.ctrlKey && e.key == 'ArrowUp') {
      e.preventDefault()
      btn_best()
    }
    else if (!e.ctrlKey && e.key == 'ArrowRight') {
      e.preventDefault()
      btn_next()
    }
    else if (!e.ctrlKey && e.key == 'ArrowLeft') {
      e.preventDefault()
      btn_prev()
    }
    // Ctrl-down toggles mark-last-move
    else if (e.ctrlKey && e.key == 'ArrowDown') {
      if (af.show_move.mark_last_move) {
        af.mark_last_move(false)
      } else {
        af.mark_last_move(true)
      }
    }
    // space toggles selfplay
    else if (!e.ctrlKey && e.key == ' ') { // space bar
      selfplay('toggle')
    }
    // Clear the board
    else if (e.ctrlKey && e.key == 'c') {
      af.setHandi(0)
      reset_game()
    } // clear board
    // Goto next really bad move ctrl-s
    else if (e.ctrlKey && e.key == 's') {
      goto_next_bad_move(4.0)
    } // bad move

    // Shortcuts for the settings
    else if (e.ctrlKey && e.key == 'e') { // e for emoji
      settings('show_emoji', !settings('show_emoji'))
      af.update_emoji()
    } // emoji
    else if (e.ctrlKey && e.key == 'p') { // p for probability
      settings('show_prob', !settings('show_prob'))
      af.show_prob()
    } // probability
    else if (e.ctrlKey && e.key == 'b') { // b for best moves
      settings('show_best_moves', !settings('show_best_moves'))
      if (settings('show_best_moves')) {
        af.show_best_curmoves()
      } else {
        //settings('show_best_ten', false)
        //af.show_best_curmoves()
        af.replay_all_moves()
        //$('#status').html('')
        //$('#bestscore').html('')
      }
    } // best moves
    else if (e.ctrlKey && e.key == 't') { // t for ten best moves
      settings('show_best_ten', !settings('show_best_ten'))
      if (settings('show_best_ten')) {
        settings('show_best_moves', true)
      } else {
        $('#status').html('')
      }
      af.show_best_curmoves()
    } // ten best moves
    else if (e.ctrlKey && e.key == 'a') { // a for toggle ai
      settings('disable_ai', !settings('disable_ai'))
      af.toggle_ai_buttons({ opt_auto: false })
    } // disable ai
    else if (e.ctrlKey && e.key == 'd') { // d for diagrams
      settings('diagrams', !settings('diagrams'))
      if (settings('diagrams')) {
        $('#diagram_buttons').show()
      } else {
        $('#diagram_buttons').hide()
      }
    } // diagrams

  } // check_key()

} // main()
main(JGO, axutil)
