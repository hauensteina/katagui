'use strict';

// App helper funcs

//--- Public ---
//---------------

export var grec // The game record
export var g_jrecord = new JGO.Record(BOARD_SIZE)
export var g_ko = null // ko coordinate
export var g_last_move = null // last move coordinate
// prisoner count; elt 0 unused; prisoners[1] counts the white stones who are B's prisoners;
export var g_prisoners = [0, 0, 0]

export var g_komi = 6.5
export var g_handi = 0

//-----------------------------
export function newGrec() {
    grec = new GameRecord()
} // newGrec()

//--------------------------------
export function setKomi(komi) {
    g_komi = komi
} // setKomi()

//-------------------------------------
export function setHandi(handicap) {
    g_handi = handicap
} // setHandi()

//----------------------------
export function clear_status() {
    $('#status').html('')
    $('#bestscore').html('')
    $('#emo').html('')
} // clear_status()

//----------------------------
export function set_status(x) {
    if (axutil.settings('disable_ai')) { clear_status(); return }
    if (x.indexOf('NaN') >= 0) { clear_status(); return }
    $('#status').html(x)
    $('#bestscore').html('')
} // set_status()

//------------------------------------------
export function show_prob(update_emo, playing) {
    if (!axutil.settings('show_prob')) { clear_status(); return }
    var cur = grec.curmove()
    if (cur) {
        var p = cur.p
        var score = cur.score
        // 0.8 -> 1.0; 1.3 -> 1.5 etc
        score = Math.trunc(Math.abs(score) * 2 + 0.5) * Math.sign(score) / 2.0
        if (playing && !axutil.settings('show_prob')) {
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

//--------------------------------
export function update_emoji() {
    if (axutil.settings('disable_ai')) { clear_emoji(); return }
    if (!axutil.settings('show_emoji')) { clear_emoji(); return }
    // var delta_p = grec.delta_prob()
    // if (delta_p == null) {
    //     clear_emoji();
    //     return
    // }
    // set_emoji(delta_p)
    var badness = grec. move_badness()
    if (badness == null) {
        clear_emoji()
        return
    }
    set_emoji(badness)
} // update_emoji()

//------------------------------
export function clear_emoji() {
    $('#emo').html('&nbsp;')
} // clear_emoji() 

//---------------------------------
export function set_emoji(badness) {
    const MOVE_EMOJI = ['😍', '😐', '😓', '😡']
    var emo = MOVE_EMOJI[3]

    // Get sad or angry if we lose winning probability
    const POINT_BINS = [2.0, 4.0, 8.0]
    var idx
    for (idx = 0; idx < POINT_BINS.length; idx++) {
        if (badness < POINT_BINS[idx]) break;
    }
    emo = MOVE_EMOJI[idx]
    $('#emo').html(emo)
} // set_emoji()

// Put a mark on a stone or intersection. 
// Reset if coord == 'clear'.
// marktype is one of 'letter', 'number', 'triangle'.
//------------------------------------------------------
export function add_mark(rotated_coord, marktype) {

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

    var letters = 'abcdefghijklmnopqrstuvwxyz'
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
    else if (rotated_coord == 'isempty') {
        // Check if there are any marks on the board
        for (const marktype in add_mark.orig_coords) {
            if (add_mark.orig_coords[marktype].length > 0) {
                return false
            }
        }
        return true
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

// Show a translucent hover stone
//--------------------------------------------
export function hover(coord, col, opts) {
    opts = opts || {}
    if (!opts.force) {
        if (axutil.isMobile() && col) { return }
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

//--------------------------------------------------------------
export function toggle_ai_buttons({ opt_auto = true } ) {
    // Disable/Enable some buttons if AI is disabled or not
    var ai_buttons = ['btn_best', 'btn_nnscore', 'btn_bot', 'btn_play', 'btn_tgl_selfplay']
    if (axutil.settings('disable_ai')) {
        // disable opt_auto checkbox
        $('#opt_auto').prop('checked', false)
        $('#opt_auto').prop('disabled', true)
        $('#btn_play').css('border-color', '#343A40')
        // disable ai buttons
        ai_buttons.forEach(btn => axutil.disable_button(btn))
        $('#emo').html('&nbsp;')
    } else {
        // enable opt_auto checkbox
        if (opt_auto) {
            $('#opt_auto').prop('checked', true)
            $('#btn_play').css('border-color', '#FF0000')
        }
        $('#opt_auto').prop('disabled', false)
        // enable ai buttons
        ai_buttons.forEach(btn => axutil.enable_button(btn))
    }
} // toggle_ai_buttons()

//---------------------------------------
export function initSettingSliders() {
    // Load settings
    var settings = JSON.parse(localStorage.getItem('settings'))
    if ('show_emoji' in settings) { $('#opt_show_emoji').prop('checked', settings.show_emoji) }
    if ('show_prob' in settings) { $('#opt_show_prob').prop('checked', settings.show_prob) }
    if ('show_best_moves' in settings) { $('#opt_show_best_moves').prop('checked', settings.show_best_moves) }
    if ('diagrams' in settings) { $('#opt_diagrams').prop('checked', settings.diagrams) }
    if ('disable_ai' in settings) { $('#opt_disable_ai').prop('checked', settings.disable_ai) }
    if ('show_best_ten' in settings) { $('#opt_show_best_ten').prop('checked', settings.show_best_ten) }
    $('[id^=btn_tgl_selfplay]').removeClass('active')
    var sp_id = '#btn_tgl_selfplay_normal'
    if ('selfplay_speed' in settings) { sp_id = '#btn_tgl_selfplay_' + settings.selfplay_speed }
    $(sp_id).addClass('active')

    // Self Play Speed
    $('#btn_tgl_selfplay_slow').click(() => {
        $('[id^=btn_tgl_selfplay]').removeClass('active')
        $('#btn_tgl_selfplay_slow').addClass('active')
        settings.selfplay_speed = 'slow'
    })
    $('#btn_tgl_selfplay_normal').click(() => {
        $('[id^=btn_tgl_selfplay]').removeClass('active')
        $('#btn_tgl_selfplay_normal').addClass('active')
        settings.selfplay_speed = 'normal'
    })
    $('#btn_tgl_selfplay_fast').click(() => {
        $('[id^=btn_tgl_selfplay]').removeClass('active')
        $('#btn_tgl_selfplay_fast').addClass('active')
        settings.selfplay_speed = 'fast'
    })

    // Save
    $('#btn_settings_done').click(() => {
        settings.show_emoji = $('#opt_show_emoji').prop('checked')
        settings.show_prob = $('#opt_show_prob').prop('checked')
        settings.show_best_moves = $('#opt_show_best_moves').prop('checked')
        settings.show_best_ten = $('#opt_show_best_ten').prop('checked')
        settings.disable_ai = $('#opt_disable_ai').prop('checked')
        settings.diagrams = $('#opt_diagrams').prop('checked')
        localStorage.setItem('settings', JSON.stringify(settings))

        if (axutil.settings('diagrams')) {
            $('#diagram_buttons').show()
        } else {
            $('#diagram_buttons').hide()
        }

        if (axutil.settings('show_best_moves')) {
            show_best_curmoves()
        } else {
            replay_all_moves()
        }

        toggle_ai_buttons( { opt_auto: null } )
        update_emoji()
        show_prob()

        $('#div_settings').css({ 'display': 'none' })

    }) // click
    return self
} // initSettingSliders()

/**
 * Convert a list of moves like ['Q16', ...] to SGF.
 * - moves: string[]        e.g., ["Q16", "D4", "pass", "resign"]
 * - probs: (number|string)[]  (optional) per-move probabilities
 * - scores: (number|string)[] (optional) per-move scores
 * - meta: {
 *     pb, pw, re, km, dt
 *   }
 * Notes:
 * - 'pass' and 'A0' are encoded as [tt] to mimic the original Python.
 * - 'resign' sets RE[...] for the other color (e.g., "W+R") after the header.
 */
//-----------------------------------------------------------------------
export function moves2sgf(moves, probs = [], scores = [], meta = {}) {
    // Normalize meta: replace literal 'undefined' strings with ''
    const cleanedMeta = {}
    for (const [k, v] of Object.entries(meta)) {
        cleanedMeta[k] = (v === 'undefined') ? '' : v
    }

    // Defaults
    const dt = cleanedMeta.dt || new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const km = cleanedMeta.komi || '7.5'

    let sgf = '(;FF[4]SZ[19]\n'
    sgf += 'SO[katagui.baduk.club]\n'
    sgf += `PB[${cleanedMeta.pb || ''}]\n`
    sgf += `PW[${cleanedMeta.pw || ''}]\n`
    sgf += `RE[${cleanedMeta.re || ''}]\n`
    sgf += `KM[${km}]\n`
    sgf += `DT[${dt}]\n`

    let movestr = ''
    let result = ''
    let color = 'B'

    for (let idx = 0; idx < moves.length; idx++) {
        const move = moves[idx]
        const othercol = (color === 'B') ? 'W' : 'B'

        if (move === 'resign') {
            result = `RE[${othercol}+R]`
            // After a resign, we stop adding further moves (matching the Python break)
            break
        } else if (move === 'pass' || move === 'A0') {
            movestr += `;${color}[tt]`
        } else {
            try {
                const p = pointFromCoords(move) // { col:1..19, row:1..19 }
                const col_s = 'abcdefghijklmnopqrstuvwxy'.charAt(p.col - 1)     // 0-based
                const row_s = 'abcdefghijklmnopqrstuvwxy'.charAt(19 - p.row)   // invert Y
                movestr += `;${color}[${col_s}${row_s}]`
                if (idx < probs.length && idx < scores.length) {
                    movestr += `C[P:${probs[idx]} S:${scores[idx]}]`
                }
            } catch (err) {
                console.error('Exception in moves2sgf()', err)
                console.error(`move ${move}`)
                break
            }
        }
        color = othercol
    }

    sgf += result
    sgf += movestr
    sgf += ')'
    return sgf
} // moves2sgf()

//-------------------------------------------------------------------
export function downloadSgf(filename, sgf, mime = "text/plain") {
    const blob = new Blob([sgf], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;      // e.g., "game.sgf"
    document.body.appendChild(a);
    a.click();
    a.remove();                 // cleanup
    setTimeout(() => URL.revokeObjectURL(url), 0);
} // downloadSgf()

//-----------------------------------------------------
export function show_best_curmoves() {
    if (!grec.curmove() || !grec.curmove().data) { return }
    //if (is_diagram_mode_active()) return
    show_best_moves(grec.curmove().data)
} // show_best_curmoves()

//------------------------------------------------------------
export function show_best_moves(data, best_btn_flag=false) {
    //if (!settings('show_best_moves')) { return }
    if (axutil.settings('disable_ai')) { return }
    if (!add_mark('isempty') && !best_btn_flag) { // if there are marks, show marks instead of best moves
        add_mark('redraw')
        return
    }
    if (data) { show_best_moves.data = data }
    data = show_best_moves.data
    if (!data) return
    //if (is_diagram_mode_active() && !best_btn_flag) return
    var botCoord = axutil.string2jcoord(data.bot_move)
    var best = data.diagnostics.best_ten // candidate moves sorted descending by psv
    var node = g_jrecord.createNode(true)
    replay_moves(grec.pos()) // remove artifacts, preserve mark on last play
    var mmax = 0
    // Mark candidates with letters if psv is close enough to max
    var bardata = []
    for (const [idx, m] of best.entries()) {
        //if (!axutil.endsInDigit(m.move)) { continue } // skip non-moves
        bardata.push([idx, m.psv])
        if (mmax == 0) { mmax = m.psv }
        if (!axutil.settings('show_best_ten') && m.psv < 0.05 * mmax) continue
        var botCoord1 = axutil.string2jcoord(m.move)
        if (botCoord1 != 'pass' && botCoord1 != 'resign') {
            var letter = String.fromCharCode('A'.charCodeAt(0) + idx)
            node.setMark(botCoord1, letter)
        }
    } // for
    // restore the hover stone
    if (hover.coord) {
        g_jrecord.jboard.setType(hover.coord, turn() == JGO.WHITE ? JGO.DIM_WHITE : JGO.DIM_BLACK)
    }
    var maxi = Math.max(...bardata.map(function (d) { return d[1] }))
    //console.log(maxi)
    var font = '10px sans-serif'
    if (axutil.isMobile()) { font = '20px sans-serif' }
    axutil.barchart('#status', bardata, 1.2 * maxi, font)
    // Also show score and winning prob
    var scorestr = get_scorestr(data.diagnostics.winprob, data.diagnostics.score)
    $('#bestscore').html(scorestr)
    $('#bestscore').css({ 'font': '10px sans-serif' })
    if (axutil.isMobile()) { $('#bestscore').css({ 'font': '20px sans-serif' }) }
} // show_best_moves()
show_best_moves.data = {}

// Make a string like 'P(B wins): 0.56  B+0.5'
//----------------------------------------------
export function get_scorestr(p, score) {
    p = 1 * p // convert to number

    if (g_komi == Math.floor(g_komi)) { // whole number komi
        score = Math.round(score) // 2.1 -> 2.0,  2.9 -> 3.0
    } else { // x.5 komi
        score = Math.sign(score) * (Math.floor(Math.abs(score)) + 0.5) // 2.1 -> 2.5 2.9 -> 2.5
    }
    var scorestr = '&nbsp;&nbsp;' + 'B' + '+'
    if (score < 0) {
        scorestr = '&nbsp;&nbsp;' + 'W' + '+'
    }
    scorestr += Math.abs(score)
    var res = 'P(B wins)' + ': ' + p.toFixed(2)
    if (typeof (score) !== 'undefined') {
        res += scorestr
    }
    if (p == 0 && score == 0) { res = '' }
    return res
} // get_scorestr()

// Replay n moves from empty board.
//-----------------------------------------------------
export function replay_moves(n) {
    goto_first_move()
    for (const [idx, move_prob] of grec.prefix(n).entries()) {
        var move_string = move_prob.mv
        var coord = axutil.string2jcoord(move_string)
        show_move(turn(idx), coord)
    }
    grec.seek(n)
    show_movenum()
} // replay_moves()

//--------------------------------
export function replay_all_moves() {
    replay_moves(grec.pos())
} // replay_all_moves()

// BLACK or WHITE depending on grec.pos()
//------------------------------------------
export function turn(idx_) {
    var idx = idx_ || grec.pos()
    if (idx % 2) {
        return JGO.WHITE
    }
    return JGO.BLACK
} // turn()

//------------------------------------
function is_diagram_mode_active() {
    return $('#btn_tgl_number').hasClass('btn-success')
      || $('#btn_tgl_letter').hasClass('btn-success')
      || $('#btn_tgl_x').hasClass('btn-success')
      || $('#btn_tgl_triangle').hasClass('btn-success')
      || $('#btn_tgl_circle').hasClass('btn-success')
      || $('#btn_tgl_add_black').hasClass('btn-success')
      || $('#btn_tgl_add_white').hasClass('btn-success')
  } // is_diagram_mode_active()

// Show a move on the board. 
// player == 1 or 2 meaning black or white
//--------------------------------------------
export function show_move(player, coord) {
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

        // In diagram mode, we leave captures on the board
        if (!is_diagram_mode_active()) {
            node.setType(play.captures, JGO.CLEAR)
        }

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
    } else { // Error, like ko or existing stone or suicide.
        var node = g_jrecord.createNode(true)
        if (is_diagram_mode_active()) { // In diagram mode, play the stone anyway.
            node.setType(coord, player) // play stone anyway
        }
    }
} // show_move()
show_move.mark_last_move = true
show_move.swap_colors = false

//----------------------------------------
export function mark_last_move(flag) {
    show_move.mark_last_move = flag
} // mark_last_move()

//-----------------------------------
export function swap_colors(flag) {
    show_move.swap_colors = flag
} // swap_colors()

//-------------------------------------
export function goto_first_move() {
    g_ko = false
    g_last_move = false
    grec.seek(0)
    g_jrecord.jboard.clear()
    g_jrecord.root = g_jrecord.current = null
    show_movenum()
} // goto_first_move()

//----------------------------
export function show_movenum() {
    //if (!grec.len()) { return }
    var totmoves = grec.len()
    var n = grec.pos()
    var html = `${n} / ${totmoves}<br>`
    html += 'B' + `:${g_prisoners[1]} `
    html += 'W' + `:${g_prisoners[2]} `
    $('#btn_movenum').html(html)
} // show_movenum()


//--- Private ---
//---------------

/**
 * Parse a Go coordinate like "Q16" into 1-based (col,row).
 * Columns: A..T skipping I (i.e., A=1, B=2, ..., H=8, J=9, ..., T=19)
 * Rows: 1..19 (1 is the bottom; 19 is the top)
 */
//-----------------------------------------------------
function pointFromCoords(coord, size = 19) {
    if (typeof coord !== 'string' || coord.length < 2) {
        throw new Error(`Bad coord: ${coord}`)
    }
    const letter = coord[0].toUpperCase()
    const rowNum = parseInt(coord.slice(1), 10)
    if (!Number.isInteger(rowNum) || rowNum < 1 || rowNum > size) {
        throw new Error(`Bad row in coord: ${coord}`)
    }
    if (letter < 'A' || letter > 'Z' || letter === 'I') {
        // We’ll compute col and also reject 'I' explicitly
    }
    let col = letter.charCodeAt(0) - 64; // 'A' -> 1
    if (letter >= 'I') col -= 1       // skip 'I'
    if (col < 1 || col > size) {
        throw new Error(`Bad column in coord: ${coord}`)
    }
    return { col, row: rowNum }
} // pointFromCoords()
