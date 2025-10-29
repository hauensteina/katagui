// SGF main-variation parser for Go (FF[4]) — zero deps
// -------------------------------------------------------
// Parses only the **main line** (first variation) from an SGF collection.
// Returns a flat array of nodes along the main variation, preserving props.
//

'use strict';

/** @typedef {{ [k: string]: string[] }} SGFProps */
/** @typedef {{ props: SGFProps }} SGFNode */

//---------------------------
function svg2sgf(tstr) {
  // Katagui SVG export embeds SGF in the SVG as a comment.
  const matches = tstr.match(/<katagui>(.*?)<\/katagui>/s);
  if (matches) {
    const jsonstr = matches[1];
    const meta = JSON.parse(jsonstr);
    const sgfstr = meta.sgf;
    return sgfstr;
  } else {
    return tstr;
  }
} // svg2sgf(tstr)

//--------------------------------------------
function getMove(node) { // pq -> ['B', Q3]
    let color
    if (node.props.B) color = 'B'
    else if (node.props.W) color = 'W' 
    if (!color) return  ['','']
    let point
    if (node.props.B && node.props.B.length)  { point =  node.props.B[0] }
    else if (node.props.W && node.props.W.length)  { point =  node.props.W[0] }
    return [ color, coordsFromPoint(point) ]
} // getMove()

//--------------------------------
function coordsFromPoint(p) { // pq -> Q3
    const letters = 'ABCDEFGHJKLMNOPQRST'
    var col = p[0].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0)
    var row = 19 - (p[1].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0))
    return `${letters[col]}${row}`
} // coordsFromPoint()

//----------------------------------
export function sgf2list(sgf) {
    sgf = svg2sgf(sgf)
    var RE = getSgfTag(sgf, 'RE')
    var winner = ''
    if (RE.toLowerCase().startsWith('w')) winner = 'w'
    if (RE.length > 10) RE = ''
    else if (RE.toLowerCase().startsWith('b')) winner = 'b'
    var DT = getSgfTag(sgf, 'DT')
    if (DT.length > 15) DT = ''
    var player_white = getSgfTag(sgf, 'PW')
    var player_black = getSgfTag(sgf, 'PB')
    var komi = parseFloat(getSgfTag(sgf, 'KM')) || 0.0
    if (komi > 100) { komi = 2 * komi / 100.0 } // Fox anomaly 375 -> 7.5

    var moves = []
    var handicap_setup_done = false
    const nodes = parseMainLine(sgf)
    for (const [index, n] of nodes.entries()) {
        // Deal with handicap stones in the root node. Also deals with kifucam exports.
        if (index == 0 && (n.props.AB || n.props.AW)) {
            addSetupStones(moves, n)
            handicap_setup_done = true
            continue
        }
        var p = '0.00'
        var score = '0.00'
        var turn = 'B'
        if (moves.length % 2) turn = 'W'
        let [color, mv] = getMove(n) // ['B', 'Q16']
        if (color) {
            if (color != turn) {
                moves.push({ 'mv': 'pass', 'p': '0.00', 'score': '0.00' })
            }
            if (!mv || mv.length < 2) mv = 'pass'
            var move = { 'mv': mv, 'p': '0.00', 'score': '0.00' }
            moves.push(move)
        } else if (!handicap_setup_done && n.props.AB) {
            // Deal with handicap stones as individual nodes
            stones = []
            addSetupStones(stones, n)
            if (stones.length > 1) {
                AhauxUtils.popup(tr('Error'), tr('Multiple handicap stones in one node are not supported.'))
            }
            if (moves) { // white pass before next handi stone
                moves.push({ 'mv': 'pass', 'p': '0.00', 'score': '0.00' })
            }
            moves.push(stones[0])
        }
    } // for nodes
    const probs = moves.map(m => m.p)
    const scores = moves.map(m => m.score)
    moves = moves.map(m => m.mv)
    const res = {
        'moves':moves, 'probs':probs, 'scores':scores, 
        'pb':player_black, 'pw':player_white, 
        'winner':winner, 'komi':komi, 'RE':RE, 'DT':DT 
    }
    debugger
    return res
} // sgf2list()

//-----------------------------------------
function addSetupStones( moves, node) {
    let bp = node.props.AB || []
    let wp = node.props.AW || []
    shuffle(bp)
    shuffle(wp)
    for (let i = 0; i < Math.max(bp.length, wp.length); i++) {
        if (i < bp.length) {
            moves.push( {'mv': coordsFromPoint(bp[i]),  'p': '0.00', 'score': '0.00'})
        } else {
            moves.push( {'mv':'pass', 'p':'0.00', 'score':'0.00'})
        }
        if (i < wp.length) {
            moves.push( {'mv': coordsFromPoint(wp[i]),  'p': '0.00', 'score': '0.00'})
        } else {
            moves.push( {'mv':'pass', 'p':'0.00', 'score':'0.00'})
        }
    } // for
    // Remove trailing passes from moves
    while (moves.length) {
        const last = moves[moves.length - 1]
        if (last.mv === 'pass') { moves.pop() } else { break }
    } // while
} // addSetupStones()

// Shuffle array in place. Fisher–Yates (Knuth) shuffle.
//-----------------------------------------------------------
function shuffle(array) {
    let m = array.length;
    let i = 0;

    while (m > 0) {
        // Pick a remaining element…
        i = Math.floor(Math.random() * m);
        m -= 1;

        // And swap it with the current element.
        [array[m], array[i]] = [array[i], array[m]];
    }
    return array;
} // shuffle()

//------------------------------------
function getSgfTag(sgfstr, tag) {
  const rexp = new RegExp(`.*${tag}\\[([^\\[]*)\\].*`, 's')
  const res = sgfstr.replace(rexp, '$1')
  if (res === sgfstr) return '' // tag not found
  return res
} // getSgfTag()

//-----------------------------------------
export function parseMainLine(sgf) {
  const s = normalizeInput(sgf)
  let i = 0

  // Skip to first game-tree
  while (i < s.length && s[i] !== '(') i++
  if (i >= s.length) return { nodes: [], collectionCount: 0 }

  let collectionCount = 0
  let nodes = []

  // Parse only the first game-tree's main line
  const [treeNodes, nextIdx] = parseGameTreeMain(s, i)
  nodes = treeNodes
  i = nextIdx

  return nodes
} // parseMainLine()

// -----------------------
// Parsing internals
// -----------------------
//-------------------------------
function normalizeInput(s) {
  // Strip unicode Byte Order Mark, unify line endings
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1)
  return s.replace(/\r\n?|\f/g, '\n')
} // normalizeInput()

//------------------------------------
function parseGameTreeMain(s, i) {
  // grammar: '(' sequence game-tree* ')'
  if (s[i] !== '(') throw new Error(`Expected '(' at ${i}`)
  i++

  let nodes = []
  // sequence: ;node ;node ...
  while (true) {
    i = skipWS(s, i)
    if (s[i] === ';') {
      const [node, j] = parseNode(s, i + 1)
      nodes.push(node)
      i = j
      continue
    }
    break
  }
  // game-tree*: multiple variations — follow only the FIRST one, skip the rest
  i = skipWS(s, i)
  if (s[i] === '(') {
    // parse first child main line
    const [childNodes, k] = parseGameTreeMain(s, i)
    nodes = nodes.concat(childNodes)
    i = k
    // skip any additional sibling variations at this level to get to the closing paren
    i = skipWS(s, i)
    while (s[i] === '(') {
      i = skipGameTree(s, i)
      i = skipWS(s, i)
    } // while
  } // if

  if (s[i] !== ')') throw new Error(`Expected ')' at ${i}`)
  return [nodes, i + 1]
} // parseGameTreeMain()

//---------------------------------
function skipGameTree(s, i) {
  // Skip a balanced game-tree starting at '(' without parsing its content
  if (s[i] !== '(') throw new Error(`Expected '(' at ${i}`)
  let depth = 0
  while (i < s.length) {
    const ch = s[i++]
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) break
    } else if (ch === '[') {
      // Skip bracket content with escapes
      while (i < s.length) {
        if (s[i] === '\\') { i += 2; continue }
        if (s[i] === ']') { i++; break }
        i++
      }
    }
  }
  return i
} // skipGameTree()

//------------------------------
function parseNode(s, i) {
    // node: one or more properties:  IDENT '[' value ']'  (value may repeat)
    /** @type {SGFProps} */
    const props = {}
    while (i < s.length) {
        i = skipWS(s, i)
        const idStart = i
        while (i < s.length && s[i] >= 'A' && s[i] <= 'Z') i++
        if (i === idStart) break // no more properties
        const ident = s.slice(idStart, i)
        const values = []
        i = skipWS(s, i)
        if (s[i] !== '[') throw new Error(`Expected '[' after ${ident} at ${i}`)
        while (s[i] === '[') {
            const [val, j] = parseValue(s, i + 1)
            values.push(val)
            i = j
            i = skipWS(s, i)
        }
        if (props[ident]) { // append to existing
            props[ident] = props[ident].concat(values)
        } else {
            props[ident] = values
        }
    } // while
    return [{ props }, i]
} // parseNode()

//---------------------------------
function parseValue(s, i) {
  // value content until matching ']' with SGF escapes
  let out = ''
  while (i < s.length) {
    const ch = s[i]
    if (ch === ']') return [out, i + 1]
    if (ch === '\\') {
      // Escape: include next char literally (including newline)
      if (i + 1 < s.length) {
        const next = s[i + 1]
        // SGF line continuation: backslash followed by newline => remove both
        if (next === '\n') { i += 2; continue }
        out += next
        i += 2
        continue
      } else {
        i++
        continue
      }
    }
    out += ch
    i++
  }
  throw new Error('Unterminated value')
} // parseValue()

//--------------------------
function skipWS(s, i) {
  while (i < s.length) {
    const c = s[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++
    else break
  }
  return i
} // skipWS()

//------------------------------------------------
function countSiblingTopLevelTrees(s, i) {
  // Count additional '(' at top level after position i
  let count = 0
  let depth = 0
  for (; i < s.length; i++) {
    const ch = s[i]
    if (ch === '(') {
      if (depth === 0) count++
      depth++
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1)
    } else if (ch === '[') {
      // skip bracketed values
      i++
      while (i < s.length) {
        if (s[i] === '\\') { i += 2; continue }
        if (s[i] === ']') break
        i++
      }
    }
  }
  return count
} // countSiblingTopLevelTrees()

// -----------
// Helpers 
// -----------
//---------------------------------------
export function movesFrom(nodes) {
  const out = []
  for (const n of nodes) {
    if (n.props.B && n.props.B.length) out.push({ color: 'B', point: n.props.B[0] || null })
    if (n.props.W && n.props.W.length) out.push({ color: 'W', point: n.props.W[0] || null })
  }
  return out
} // movesFrom()

//--------------------------------------
export function rootProps(nodes) {
  return nodes.length ? nodes[0].props : {}
} // rootProps()


// -----------------------
// Tiny demo
// -----------------------
// const sgf = '(;FF[4]GM[1]SZ[19]PB[Lee]PW[Cho];B[pd];W[dd];B[qp](;W[dc])(;W[pp]))'
// const nodes  = parseMainLine(sgf)
// console.log(movesFrom(nodes)) 

