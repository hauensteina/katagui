
/* Various js utility funcs and classes
 AHN, Apr 2019
 */

'use strict'

const DDATE = ''
const VERSION = '3.9.17'

const COLNAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T']
const BOARD_SIZE = 19

//=====================
class AhauxUtils
{

  // Compare two dot separated numerical version strings
  //-------------------------------------------------------
  compversions( v1, v2) {
    var parts1 = v1.split('.').map( Number)
    var parts2 = v2.split('.').map( Number)
    if (parts2.length < parts1.length) {
      [parts1, parts2] = [parts2, parts1]
    }

    function comp( acc, curr, index) {
      if (acc != 0) { return acc }
      if (parts1[index] < parts2[index]) { return -1 }
      if (parts1[index] > parts2[index]) { return 1 }
      return 0
    }

    var res = parts1.reduce( comp, 0)
    return res
  } // compversions()

  // We need jquery
  //-------------------------
  constructor( $, d3) {
    if (this.compversions( $.prototype.jquery, '3.4.0') < 0) {
      console.log( 'WARNING: AhauxUtils: jquery version ' + $.prototype.jquery + ' is below 3.4.0. Things might break.')
    }
    this.$ = $
    this.d3 = d3

    this.hit_endpoint('init')

  } // constructor()

  // Make a deep copy of any object
  //----------------------------------
  deepcopy( x) {
    var res = JSON.parse( JSON.stringify( x))
    return res
  } // deepcopy()

  // Store and retrieve global client-side settings
  //--------------------------------------------------------
  settings( key, value) {
    const settings_defaults = { show_emoji:true, show_prob:true, logged_in:false, selfplay:false, show_best_ten: false, play_a:false }
    var settings = JSON.parse( localStorage.getItem( 'settings'))
    if (!settings) {
      localStorage.setItem( 'settings', JSON.stringify( settings_defaults))
      settings = JSON.parse( localStorage.getItem( 'settings'))
    }
    // init
    if (typeof key == 'undefined') { return 0 }
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
    return 0
  } // settings()

  // Set attr via jQuery if it was different
  //--------------------------------------------
  set_attr( elt, attr, val) {
    if ($(elt).attr(attr) != val) {
      $(elt).attr(attr,val)
    }
  } // set_attr()

  isMobile() { return typeof window.orientation !== 'undefined' }
  isDesktop() { return typeof window.orientation == 'undefined' }
  //isMobile() { return window.innerHeight / window.innerWidth > 1.2 }
  //isDesktop() { return window.innerHeight / window.innerWidth <= 1.2 }

 //===============
  // Converters
  //===============

  // Record has tuples (mv,p,score,agent). Turn into a list of score.
  //------------------------------------------------------------------
  scores_only( record) {
    var res = []
    for (var move_prob of record) {
      res.push( move_prob.score)
    }
    return res
  } // scores_only()

  // Record has tuples (mv,p,agent). Turn into a list of mv.
  //----------------------------------------------------------
  moves_only( record) {
    var res = []
    for (var move_prob of record) {
      res.push( move_prob.mv)
    }
    return res
  } // moves_only()

  // Record has tuples (mv,p,agent). Turn into a list of p.
  //----------------------------------------------------------
  probs_only( record) {
    var res = []
    for (var move_prob of record) {
      res.push( move_prob.p)
    }
    return res
  } // probs_only()

  //--------------------------------------
  jcoord2string( jgo_coord) {
    if (jgo_coord == 'pass' || jgo_coord == 'resign') { return jgo_coord }
    var row = (BOARD_SIZE - 1) - jgo_coord.j
    var col = jgo_coord.i
    return COLNAMES[col] + ((row + 1).toString())
  } // jcoord2string()

  //--------------------------------------
  string2jcoord( move_string) {
    if (move_string == 'pass' || move_string == 'resign') { return move_string }
    var colStr = move_string.substring(0, 1)
    var rowStr = move_string.substring(1)
    var col = COLNAMES.indexOf(colStr)
    var row = BOARD_SIZE - parseInt(rowStr, 10)
    return new JGO.Coordinate(col, row)
  } // string2jcoord()

  // Turn a server (row, col) into a JGO coordinate
  //--------------------------------------------------
  rc2jcoord( row, col) {
    return new JGO.Coordinate( col - 1, BOARD_SIZE - row)
  } // rc2jcoord()

  // Turn a jgo coord into a linear array index
  //----------------------------------------------
  jcoord2idx( jcoord) {
    if (jcoord == 'pass' || jcoord == 'resign') { return -1 }
    var idx = (BOARD_SIZE - jcoord.j - 1) * BOARD_SIZE + jcoord.i
    return idx
  } // jcoord2idx()

  //-----------------
  //--- API stuff ---
  //-----------------

  // Hit any endpoint and call completion with result
  //---------------------------------------------------
  hit_endpoint( url, args, completion) {
    if (url == 'init') {
      this.hit_endpoint.waiting = false
      this.hit_endpoint.request_id = ''
      return 0
    }
    else if (url == 'waiting') { return this.hit_endpoint.waiting }
    else if (url == 'cancel') { this.hit_endpoint.waiting = false; return 0 }
    else if (this.hit_endpoint.waiting) { return 0 }

    this.hit_endpoint.request_id = ''
    url += '?tt=' + Math.random() // prevent caching
    if ('config' in args) {
      this.hit_endpoint.request_id = Math.random() + ''
      args.config.request_id = this.hit_endpoint.request_id
    }
    this.hit_endpoint.waiting = true
    fetch( url,
	   {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
             },
             body: JSON.stringify( args),
	   }
	 ).then( (resp) => {
	   resp.json().then( (resp) => {
             if ('request_id' in resp) {
               if (resp.request_id != this.hit_endpoint.request_id) {
	         return 0
	       }
	     }
	     this.hit_endpoint.waiting = false
	     if ('error' in resp) {
	       console.log( 'ERROR: hit_endpoint(): ' + url + ' ' + resp.error)
	     }
	     else {
               completion( resp)
	     }
	     return 0
	   })
	 }).catch(
	   (error) => {
	     console.log( error)
	   }
	 )
    return 0
  } // hit_endpoint()

  // Hit an endpoint, no questions asked.
  //-------------------------------------------------
  hit_endpoint_simple( url, args, completion) {
    url += '?tt=' + Math.random() // prevent caching
    fetch( url,
	   {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
             },
             body: JSON.stringify( args),
	   }
	 ).then( (resp) => {
	   resp.json().then( (resp) => {
             completion( resp)
	   }) }
	       ).catch(
		 (error) => {
		   console.log( error)
		 }
	       )
  } // hit_endpoint_simple()

  // Upload a file to the server
  //--------------------------------------
  upload_file( url, args, completion) {
    var myfile = args
    var data = new FormData()
    data.append( 'file', myfile)
    url += '?tt=' + Math.random() // prevent caching
    fetch( url,
	   {
             method: 'POST',
             body: data
	   }).then( (resp) => {
             resp.json().then( (resp) => { completion( resp) }) }
		  ).catch(
		    (error) => {
		      console.log( error)
		    }
		  )
  } // upload_file()

  // Download a file generated on the back end,
  // with a callback once it got here.
  // Why is this such a nightmare?
  //-----------------------------------------------------
  download_file( url, args, fname, completion) {
    let xmlhttp = new XMLHttpRequest()

    xmlhttp.onreadystatechange = function(repl) {
      if (repl.target.readyState === 4) {
        var res = repl.currentTarget.response
        if (navigator.msSaveOrOpenBlob) { // IE
          navigator.msSaveOrOpenBlob( res, fname)
        }
        else { // All other browsers. The horror.
          let a = document.createElement("a")
          a.style = "display: none"
          document.body.appendChild(a)
          let result_url = window.URL.createObjectURL(res)
          a.href = result_url
          a.download = fname
          a.click()
          window.URL.revokeObjectURL(result_url)
          a.remove()
        }
        completion( repl)
      }
    } // onreadystatechange()
    xmlhttp.open('POST', url, true)
    xmlhttp.setRequestHeader('Content-type', 'application/json');
    xmlhttp.responseType = 'blob'
    var json_args = JSON.stringify( args)
    xmlhttp.send( json_args)
  } // download_file()

  // Write to the server log
  //--------------------------
  slog( msg) {
    var url = '/slog'
    var args = { 'msg': msg }
    fetch( url,
	   {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
             },
             body: JSON.stringify( args)
	   }
	 )
  } // slog()

  // Barchart.
  // container is a string like '#some_div_id'.
  // data looks like [[x_0,y_0], ... ] .
  // ylim is a positive float.
  //---------------------------------------------------
  barchart( container, data, ylim, font, color) {
    color = color || 'steelblue'
    var [d3,$] = [this.d3, this.$]
    var C = d3.select( container)
    $(container).html('')
    var w  = $(container).width()
    var h = $(container).height()

    //var margin = {top: 20, right: 20, bottom: 70, left: 40}
    // TODO: @@@ Margin needs to be a percentage of w and h
    var margin = {top: h*0.05, right: w*0.05, bottom: h*0.3, left: w*0.07}
    var width = w - margin.left - margin.right
    var height = h - margin.top - margin.bottom

    var svg = C.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

    var scale_x = d3.scaleBand()
      .domain( data.map( function(d) { return d[0] }))
      .rangeRound( [0, width])
      .padding( 0.05)

    var scale_y = d3.scaleLinear()
      .domain( [0, ylim])
      .range( [height, 0])

    var xAxis = d3.axisBottom(scale_x)
    //.tickFormat( d3.format( '.3f'))
    	.ticks(10)
	.tickFormat(function (d) {
	  return String.fromCharCode( 65 + d )
	})

    //var yAxis = d3.axisLeft(scale_y)

    svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis)
      .selectAll("text")
      // .style("text-anchor", "end")
      .style("font", font)
      // .attr("dx", "-.8em")
      // .attr("dy", "-.55em")
      // .attr("transform", "rotate(-90)" );

    // Show y axis label
    svg.append("text")
      .style("font", font)
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x",0 - 0.6*height)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
    //.text( ylim.toFixed(2))
      .text("PSV")

    svg.selectAll("bar")
      .data(data)
      .enter().append("rect")
      .style("fill", color)
      .attr("x", function(d) { return scale_x( d[0]) })
      .attr("width", scale_x.bandwidth())
      .attr("y", function(d) { return scale_y( d[1]) })
      .attr("height", function(d) { return height - scale_y( d[1]) })
  } // barchart()
} // class AhauxUtils

// Keep track of the game record, visible moves, variation.
//------------------------------------------------------------
class GameRecord {
  constructor() { this.record = []; this.n_visible = 0; this.var_record = []; this.var_n_visible = 0; }
  clone() {
    var copy = new GameRecord()
    copy.record = axutil.deepcopy( this.record)
    copy.n_visible = this.n_visible
    copy.var_record = axutil.deepcopy( this.var_record)
    copy.var_n_visible = this.var_n_visible
    copy.ts_latest_move = this.ts_latest_move
    copy.handicap = this.handicap
    copy.komi = this.komi
    copy.username = this.username
    return copy
  }
  update( p, score) {
    if (this.n_visible > 0) {
      this.record[ this.n_visible-1].score = score
      this.record[ this.n_visible-1].p = p
    }
  }
  push( mv) {
    this.record.push( mv); this.n_visible = this.record.length
  } // push()
  pop() { this.record.pop(); this.n_visible = this.record.length }
  pos() { return this.n_visible }
  enter_var() {
    if (this.var_record.length) { // truncate at cur move if in var
      this.record = this.record.slice( 0, this.n_visible)
      this.n_visible = this.record.length
    } else { // start var
      // squirrel away the game
      this.var_record = axutil.deepcopy( this.record); this.var_n_visible = this.n_visible;
      // Branch off at current move
      this.record = axutil.deepcopy( this.board_moves()); this.n_visible = this.len()
    }
  } // enter_var()
  exit_var() {
    this.record = axutil.deepcopy( this.var_record); this.n_visible = this.var_n_visible+1;
    this.var_record = []; this.var_n_visible = 0;
  }
  var_active() { return this.var_record.length > 0 }
  seek(n) { this.n_visible = n }
  board_moves() { return this.record.slice( 0, this.n_visible) }
  truncate() { this.record = this.board_moves() }
  all_moves() { return this.record }
  len() { return this.record.length }
  curmove() { return this.record[ this.n_visible - 1] }
  prevmove() { return this.record[ this.n_visible - 2] }
  nextmove() { return this.record[ this.n_visible] }
  prefix(n) { return this.record.slice(0,n) }
  dumps() { return JSON.stringify( {
    'record':this.record,
    'n_visible':this.n_visible,
    'var_record':this.var_record,
    'var_n_visible':this.var_n_visible,
    'ts_latest_move':this.ts_latest_move,
    'handicap' : this.handicap,
    'komi': this.komi,
    'username': this.username
  })}

  loads(json) {
    var tt = JSON.parse( json)
    this.record = tt.record
    this.n_visible = tt.n_visible
    this.var_record = tt.var_record
    this.var_n_visible = tt.var_n_visible
    this.ts_latest_move = tt.ts_latest_move
    this.handicap = tt.handicap
    this.komi = tt.komi
    this.username = tt.username
  }
  dbsave() { // update game in db; notify observers via redis
    axutil.hit_endpoint_simple( '/update_game',{'game_record':this.dumps(), 'client_timestamp':Date.now()}, (resp)=>{})
  }
  dbload( game_hash, completion) { // load game from db
    axutil.hit_endpoint_simple( '/load_game',{'game_hash':game_hash},
				(resp)=>{
				  this.from_dict( resp)
				  completion()
				})
  } // dbload()
  from_dict( d) { // load game from db dictionary
    this.record = d.game_record.record
    this.n_visible = d.game_record.n_visible
    this.var_record = d.game_record.var_record
    this.var_n_visible = d.game_record.var_n_visible
    this.ts_latest_move = new Date( d.ts_latest_move)
    this.handicap = d.handicap
    this.komi = d.komi
    this.username = d.username
  } // from_dict()
} // class GameRecord

// Get translation table and user data from the server.
// Cache and provide access methods.
//--------------------------------------------------------
class ServerData {
  constructor( axutil, completion) {
    this.transtable = {}
    this.userdata = {}
    axutil.hit_endpoint_simple( '/get_user_data', {},
				(userdata)=>{
				  this.userdata = userdata
				  axutil.hit_endpoint_simple( '/get_translation_table',{}, (ttable)=>{
				    this.transtable = ttable
				    completion()
				  })
				})
  }
  translate( text) {
    try {
      var lang = this.userdata['lang']
      if (!lang) { lang = 'eng' }
      var tab = this.transtable[lang]
      var res = tab[text]
      if (!res) { return text }
      return res
    }
    catch( err) {
      return text
    }
  }
} // class ServerData
