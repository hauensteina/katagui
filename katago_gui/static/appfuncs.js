
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
            $('#opt_auto').prop('disabled', true)
            // disable ai buttons
            ai_buttons.forEach(btn => axutil.disable_button(btn))
            $('#emo').html('&nbsp;')
        } else {
            // enable opt_auto checkbox
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
            appfuncs.toggle_ai_buttons()
            main.update_emoji()
            main.show_prob()
            main.show_best_curmoves()

            //window.location.href = '/index'
            $('#div_settings').css({ 'display': 'none' })
        }) // click
        return self
    } // initSettingSliders()


} // class AppFuncs