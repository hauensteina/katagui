'use strict';

// Globally visible app specific funcs

class AppFuncs {

    //---------------------
    constructor() {
        console.log('AppFuncs constructor')
    } // constructor()

    //---------------------------------------
    toggle_ai_buttons() {
        // Disable/Enable some buttons if AI is disabled or not
        var ai_buttons = ['btn_best', 'btn_nnscore', 'btn_bot', 'btn_play', 'btn_tgl_selfplay']
        if (axutil.settings('disable_ai')) {
            // disable opt_auto checkbox

            $('#opt_auto').prop('checked', false)
            $('#opt_auto').prop('disabled', true)
            // disable ai buttons
            ai_buttons.forEach(btn => axutil.disable_button(btn))
            $('#emo').html('&nbsp;')
        } else {
            // enable opt_auto checkbox
            $('#opt_auto').prop('checked', true)
            $('#opt_auto').prop('disabled', false)
            // enable ai buttons
            ai_buttons.forEach(btn => axutil.enable_button(btn))
        }
    } // toggle_ai_buttons()


    //--------------------------
    initSettingSliders() {
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
                main.show_best_curmoves()
            } else {
                main.replay_all_moves()
            }

            appfuncs.toggle_ai_buttons()
            main.update_emoji()
            main.show_prob()

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
    //--------------------------------------------------------
    moves2sgf(moves, probs = [], scores = [], meta = {}) {
        // Normalize meta: replace literal 'undefined' strings with ''
        const cleanedMeta = {}
        for (const [k, v] of Object.entries(meta)) {
            cleanedMeta[k] = (v === 'undefined') ? '' : v
        }

        // Defaults
        const dt = cleanedMeta.dt || new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const km = cleanedMeta.km || '7.5'

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
                    const p = this.pointFromCoords(move) // { col:1..19, row:1..19 }
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

    /**
     * Parse a Go coordinate like "Q16" into 1-based (col,row).
     * Columns: A..T skipping I (i.e., A=1, B=2, ..., H=8, J=9, ..., T=19)
     * Rows: 1..19 (1 is the bottom; 19 is the top)
     */
    //--------------------------------------
    pointFromCoords(coord, size = 19) {
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

    //----------------------------------------------------
    downloadSgf(filename, sgf, mime = "text/plain") {
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

} // class AppFuncs
