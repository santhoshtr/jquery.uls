/**
 * jQuery language filter plugin.
 *
 * Copyright (C) 2012 Alolita Sharma, Amir Aharoni, Arun Ganesh, Brandon Harris,
 * Niklas Laxström, Pau Giner, Santhosh Thottingal, Siebrand Mazeland and other
 * contributors. See CREDITS for a list.
 *
 * UniversalLanguageSelector is dual licensed GPLv2 or later and MIT. You don't
 * have to do anything special to choose one license or the other and you don't
 * have to notify anyone which license you are using. You are free to use
 * UniversalLanguageSelector in commercial projects as long as the copyright
 * header is left intact. See files GPL-LICENSE and MIT-LICENSE for details.
 *
 * @file
 * @ingroup Extensions
 * @licence GNU General Public Licence 2.0 or later
 * @licence MIT License
 */

import languageData from '@wikimedia/language-data'
import { escapeRegex, debounce, isVisualPrefix, isMobile, siblings, triggerEvent } from './utils'

const defaults = {
  // LanguageCategoryDisplay
  lcd: undefined,
  // URL to which we append query parameter with the query value
  searchAPI: undefined,
  // What is this ULS used for.
  // Should be set for distinguishing between different instances of ULS
  // in the same application.
  ulsPurpose: '',
  // Object of language tags to language names
  languages: [],
  // Callback function when language is selected
  onSelect: undefined
}

export default class LanguageFilter {
  constructor (element, options) {
    this.element = element
    this.options = { ...defaults, ...options }
    this.element.classList.add('languagefilter')
    this.resultCount = 0
    this.suggestion = siblings(this.element, '.' + this.element.dataset.suggestion)
    this.clear = siblings(this.element, '.' + this.element.dataset.clear)
    this.selectedLanguage = null
    this.init()
    this.listen()
  }

  init () {
    this.search()
  }

  listen () {
    this.element.addEventListener('keydown', this.keypress.bind(this))
    this.element.addEventListener('input', debounce(this.onInputChange.bind(this), 300))

    if (this.clear) {
      this.clear.addEventListener('click', this.clear.bind(this))
    }

    this.toggleClear()
  }

  onInputChange () {
    this.selectedLanguage = null

    if (!this.element.value) {
      this.clear()
    } else {
      // empty lcd
      while (this.options.lcd.firstChild) {
        this.options.lcd.removeChild(this.options.lcd.firstChild)
      }

      this.search()
    }

    this.toggleClear()
  }

  keypress (e) {
    let suggestion, query

    switch (e.keyCode) {
      case 9: // Tab -> Autocomplete
        suggestion = this.suggestion.value

        if (suggestion && suggestion !== this.element.value) {
          this.element.val(suggestion)
          e.preventDefault()
          e.stopPropagation()
        }
        break
      case 13: // Enter
        if (!this.options.onSelect) {
          break
        }

        // Avoid bubbling this 'enter' to background page elements
        e.preventDefault()
        e.stopPropagation()

        query = (this.element.value || '').trim().toLowerCase()

        if (this.selectedLanguage) {
          // this.selectLanguage will be populated from a matching search
          this.options.onSelect(this.selectedLanguage, e)
        } else if (this.options.languages[query]) {
          // Search is yet to happen (in timeout delay),
          // but we have a matching language code.
          this.options.onSelect(query, e)
        }

        break
    }
  }

  /**
   * Clears the current search removing
   * clear buttons and suggestions.
   */
  deactivate () {
    this.element.val('')

    if (!isMobile()) {
      this.element.trigger('focus')
    }

    this.toggleClear()
    this.autofill()
  }

  /**
   * Clears the search and shows all languages
   */
  clear () {
    this.deactivate()
    this.search()
  }

  /**
   * Toggles the visibility of clear icon depending
   * on whether there is anything to clear.
   */
  toggleClear () {
    if (!this.clear) {
      return
    }

    if (this.element.value) {
      this.clear.style.display = ''
    } else {
      this.clear.style.display = 'none'
    }
  }

  search () {
    const languages = Object.keys(this.options.languages)
    let results = []
    const query = (this.element.value || '').trim().toLowerCase()

    if (query === '') {
      this.options.lcd.setGroupByRegionOverride(null)
      this.resultHandler(query, languages)
      return
    }

    this.options.lcd.setGroupByRegionOverride(false)
    // Local search results
    results = languages.filter(function (langCode) {
      return this.filter(langCode, query)
    }.bind(this))

    // Use the searchAPI if available, assuming that it has superior search results.
    if (this.options.searchAPI) {
      this.searchAPI(query)
        .done(this.resultHandler.bind(this))
        .fail(this.resultHandler.bind(this, query, results, undefined))
    } else {
      this.resultHandler(query, results)
    }
  }

  searchAPI (query) {
    return fetch(this.options.searchAPI, { search: query }).then(function (result) {
      let autofillLabel
      const results = []

      result.languagesearch.each(function (apiCode, name) {
        let code, redirect

        if (this.options.languages[apiCode]) {
          code = apiCode
        } else {
          redirect = languageData.isRedirect(apiCode)
          if (!redirect || !this.options.languages[redirect]) {
            return
          }
          code = redirect
        }

        // Because of the redirect checking above, we might get duplicates.
        // For example if API returns both `sr` and `sr-cyrl`, the former
        // could get mapped to `sr-cyrl` and then we would have it twice.
        // The exact cases when this happens of course depends on what is in
        // options.languages, which might contain redirects such as `sr`. In
        // this case we only show `sr` if no other variants are there.
        // This also protects against broken search APIs returning duplicate
        // results, although that is not happening in practice.
        if (results.indexOf(code) === -1) {
          autofillLabel = autofillLabel || name
          results.push(code)
        }
      }.bind(this))

      return Promise.resolve(query, results, autofillLabel)
    }.bind(this))
  }

  /**
   * Handler method to be called once search is over.
   * Based on search result triggers resultsfound or noresults events
   *
   * @param {string} query
   * @param {string[]} results
   * @param {string} [autofillLabel]
   */
  resultHandler (query, results, autofillLabel) {
    if (results.length === 0) {
      if (this.suggestion) {
        this.suggestion.value = ''
      }
      this.element.trigger(
        'noresults.uls',
        {
          query: query,
          ulsPurpose: this.options.ulsPurpose
        }
      )
      return
    }

    if (query) {
      this.selectedLanguage = results[0]
      this.autofill(results[0], autofillLabel)
    }

    results.map(this.render.bind(this))
    triggerEvent(this.element, 'resultsfound.uls', [query, results.length])
  }

  autofill (langCode, languageName) {
    if (!this.suggestion) {
      return
    }

    if (!this.element.value) {
      this.suggestion.value = ''
      return
    }

    languageName = languageName || this.options.languages[langCode]

    if (!languageName) {
      return
    }

    const userInput = this.element.value
    let suggestion = userInput +
      languageName.substring(userInput.length, languageName.length)

    if (suggestion.toLowerCase() !== languageName.toLowerCase()) {
      // see if it was autonym match
      const autonym = languageData.getAutonym(langCode) || ''
      suggestion = userInput + autonym.substring(userInput.length, autonym.length)

      if (suggestion !== autonym) {
        // Give up. It may be an ISO/script code match.
        suggestion = ''
      }
    }

    // Make sure that it is a visual prefix.
    if (!isVisualPrefix(userInput, suggestion)) {
      suggestion = ''
    }

    this.suggestion.value = suggestion
  }

  render (langCode) {
    return this.options.lcd.append(langCode)
  }

  /**
   * A search match happens if any of the following passes:
   * a) Language name in current user interface language
   * 'starts with' search string.
   * b) Language autonym 'starts with' search string.
   * c) ISO 639 code match with search string.
   * d) ISO 15924 code for the script match the search string.
   *
   * @param {string} langCode
   * @param {string} searchTerm
   * @return {boolean}
   */
  filter (langCode, searchTerm) {
    // FIXME script is ISO 15924 code. We might need actual name of script.
    const matcher = new RegExp('^' + escapeRegex(searchTerm), 'i')
    const languageName = this.options.languages[langCode]

    return matcher.test(languageName) ||
      matcher.test(languageData.getAutonym(langCode)) ||
      matcher.test(langCode) ||
      matcher.test(languageData.getScript(langCode))
  }
}
