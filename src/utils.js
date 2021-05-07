/**
 * @param {String} HTML representing a single element
 * @return {Element}
 */
function htmlToElement (html) {
  const template = document.createElement('template')
  html = html.trim() // Never return a text node of whitespace as the result
  template.innerHTML = html
  return template.content.firstChild
}

/**
 *
 * @param {Element} el
 * @returns {number}
 */
function outerWidth (el) {
  let width = el.offsetWidth
  const style = window.getComputedStyle(el)

  width += parseInt(style.marginLeft) + parseInt(style.marginRight)
  return width
}

function debounce (func, timeout = 300) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => { func.apply(this, args) }, timeout)
  }
}

/**
 * Check if a prefix is visually prefix of a string
 *
 * @param {string} prefix
 * @param {string} string
 * @return {boolean}
 */
function isVisualPrefix (prefix, string) {
  // Pre-base vowel signs of Indic languages. A vowel sign is called pre-base if
  // consonant + vowel becomes [vowel][consonant] when rendered. Eg: ക + െ => കെ
  const prebases = 'െേൈൊോൌெேைொோௌେୈୋୌિਿिিেৈোৌෙේෛොෝෞ'
  return prebases.indexOf(string[prefix.length]) <= 0
}

function escapeRegex (value) {
  return value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
}

function isMobile () {
  return navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry)/)
}

function matches (el, selector) {
  return (el.matches || el.matchesSelector || el.msMatchesSelector || el.mozMatchesSelector || el.webkitMatchesSelector || el.oMatchesSelector).call(el, selector)
}

function offset (el) {
  const rect = el.getBoundingClientRect()
  return {
    top: rect.top + document.body.scrollTop,
    left: rect.left + document.body.scrollLeft
  }
}

function appendChildren (parent, children) {
  for (let i = 0; i < children.length; i++) {
    parent.appendChild(children[i])
  }
  return parent
}

function siblings (el, selector) {
  Array.prototype.filter.call(el.parentNode.children, function (child) {
    return child !== el && matches(child, selector)
  })
}

function triggerEvent (el, eventName, data) {
  let event
  if (window.CustomEvent && typeof window.CustomEvent === 'function') {
    event = new window.CustomEvent(eventName, { detail: data })
  } else {
    event = document.createEvent('CustomEvent')
    event.initCustomEvent(eventName, true, true, data)
  }

  el.dispatchEvent(event)
}

export {
  htmlToElement,
  outerWidth,
  isVisualPrefix,
  siblings,
  isMobile,
  matches,
  debounce,
  offset,
  appendChildren,
  escapeRegex,
  triggerEvent
}
