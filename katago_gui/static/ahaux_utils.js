
/* Various js utility funcs
   AHN, Apr 2019
 */

'use strict'

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
  }

  // We need d3 and jquery
  //-------------------------
  constructor( d3, $) {
    if (this.compversions( d3.version, '5.9.2') < 0) {
      console.log( 'WARNING: AhauxUtils: d3 version ' + d3.version + ' is below 5.9.2. Things might break.')
    }
    if (this.compversions( $.prototype.jquery, '3.4.0') < 0) {
      console.log( 'WARNING: AhauxUtils: jquery version ' + $.prototype.jquery + ' is below 3.4.0. Things might break.')
    }
    this.d3 = d3
    this.$ = $

    this.hit_endpoint('init')

  } // constructor()

  // Store and retrieve global client-side settings
  //--------------------------------------------------------
  settings( key, value) {
    const settings_defaults = { show_emoji:true, show_prob:true, logged_in:false, selfplay:false }
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

  isMobile() { return typeof window.orientation !== "undefined" }
  isDesktop() { return typeof window.orientation == "undefined" }

  //----------------------------
  //--- D3 graphics routines ---
  //----------------------------

  // Simple line chart using d3.
  // container is a string like '#some_div_id'.
  // data looks like [[x_0,y_0], ... ] .
  // xlim and ylim are pairs like [x_min,x_max] .
  //----------------------------------------------
  plot_line( container, data, xlim, ylim, color) {
    color = color || 'steelblue'
    var [d3,$] = [this.d3, this.$]
    var C = d3.select( container)
    $(container).html('')
    var w  = $(container).width()
    var h = $(container).height()

    var margin = {top: 50, right: 50, bottom: 50, left: 50}
      ,width = w - margin.left - margin.right
      ,height = h - margin.top - margin.bottom

    var scale_x = d3.scaleLinear()
      .domain([xlim[0], xlim[1]]) // input
      .range([0, width]) // output

    var scale_y = d3.scaleLinear()
      .domain([ylim[0], ylim[1]]) // input
      .range([height, 0]) // output

    var line = d3.line()
      .x(function(d, i) {
        return scale_x( d[0]) }) // set the x values for the line generator
      .y(function(d, i) {
        return scale_y( d[1]) }) // set the y values for the line generator

    // Add the SVG to the container, with margins
    var svg = C.append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

    // Add x axis
    svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + height + ')')
      .call(d3.axisBottom(scale_x)) // run axisBottom on the g thingy

    // Add y axis
    svg.append('g')
      .attr('class', 'y axis')
      .call(d3.axisLeft(scale_y)) // run axisLeft on the g thingy

    // Draw the line
    svg.append('path')
      .datum(data) // Binds data to the line
      .attr('style', 'fill:none;stroke:' + color + ';stroke-width:3')
      .attr('d', line) // Call the line generator

  } // plot_line()

  // Barchart.
  // container is a string like '#some_div_id'.
  // data looks like [[x_0,y_0], ... ] .
  // ylim is a positive float.
  //----------------------------------------------
  barchart( container, data, ylim, color) {
    color = color || 'steelblue'
    var [d3,$] = [this.d3, this.$]
    var C = d3.select( container)
    $(container).html('')
    var w  = $(container).width()
    var h = $(container).height()

    var margin = {top: 20, right: 20, bottom: 70, left: 40}
      ,width = w - margin.left - margin.right
      ,height = h - margin.top - margin.bottom

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
      .tickFormat( d3.format( '.3f'))

    var yAxis = d3.axisLeft(scale_y)

    svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", "-.55em")
      .attr("transform", "rotate(-90)" );

    svg.append("g")
      .attr("class", "y axis")
      .call(yAxis)

    svg.selectAll("bar")
      .data(data)
      .enter().append("rect")
      .style("fill", color)
      .attr("x", function(d) { return scale_x( d[0]) })
      .attr("width", scale_x.bandwidth())
      .attr("y", function(d) { return scale_y( d[1]) })
      .attr("height", function(d) { return height - scale_y( d[1]) })

  } // barchart()

  //-----------------
  //--- API stuff ---
  //-----------------

  // Hit any endpoint and call completion with result
  //---------------------------------------------------
  hit_endpoint( url, args, completion) {
    if (url == 'init') {
      this.hit_endpoint.waiting = false
      this.hit_endpoint.request_id = ''
      return
    }
    else if (url == 'waiting') { return this.hit_endpoint.waiting }
    else if (url == 'cancel') { this.hit_endpoint.waiting = false; return }
    else if (this.hit_endpoint.waiting) { return false; }

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
        body: JSON.stringify( args)
      }
    ).then( (resp) => {
      resp.json().then( (resp) => {
        if (!this.hit_endpoint.waiting) {
	        //console.log( 'not waiting')
          //return
        }
        if ('request_id' in resp) {
	        //console.log( 'req id: ' + resp.request_id + ' ' + this.hit_endpoint.request_id)
          if (resp.request_id != this.hit_endpoint.request_id) {
	          return
	        }
	      }
	      this.hit_endpoint.waiting = false
        completion( resp)
      }) }
    ).catch(
      (error) => {
        console.log( error)
      }
    )
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
        body: JSON.stringify( args)
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
  } // upload_file

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
} // class AhauxUtils
