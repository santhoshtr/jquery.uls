/**
 * Universal Language Selector
 * ULS core component.
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

'use strict'

import languageData from '@wikimedia/language-data'
import { htmlToElement, outerWidth, debounce, isMobile, offset } from './utils'
import LanguageFilter from './languagefilter'
import LanguageCategoryDisplay from './languagedisplay'

// Region numbers in id attributes also appear in the langdb.
// eslint-disable-next-line no-multi-str
const template = `<div class="grid uls-menu">
        <div id="search" class="row uls-search">
            <div class="uls-search-wrapper">
                <label class="uls-search-label" for="uls-languagefilter"></label>
                <div class="uls-search-input-wrapper">
                    <span class="uls-languagefilter-clear"></span>
                    <input type="text" class="uls-filterinput uls-filtersuggestion"
                        disabled="true" autocomplete="off">
                    <input type="text" class="uls-filterinput uls-languagefilter"
                        maxlength="40"
                        data-clear="uls-languagefilter-clear"
                        data-suggestion="uls-filtersuggestion"
                        placeholder="Search for a language fix this" autocomplete="off">
                </div>
            </div>
        </div>
        <div class="row uls-language-list"></div>
        <div class="row" id="uls-settings-block"></div>
    </div>`

const defaults = {
  // DEPRECATED: CSS top position for the dialog
  top: undefined,
  // DEPRECATED: CSS left position for the dialog
  left: undefined,
  // Callback function when user selects a language
  onSelect: undefined,
  // Callback function when the dialog is closed without selecting a language
  onCancel: undefined,
  // Callback function when ULS has initialized
  onReady: undefined,
  // Callback function when ULS dialog is shown
  onVisible: undefined,
  // Callback function when ULS dialog is ready to be shown
  onPosition: undefined,
  // Languages to be used for ULS, default is all languages
  languages: languageData.getAutonyms(),
  // The options are wide (4 columns), medium (2 columns), and narrow (1 column).
  // If not specified, it will be set automatically.
  menuWidth: undefined,
  // What is this ULS used for.
  // Should be set for distinguishing between different instances of ULS
  // in the same application.
  ulsPurpose: '',
  // Used by LCD
  quickList: [],
  // Used by LCD
  showRegions: ['WW', 'AM', 'EU', 'ME', 'AF', 'AS', 'PA'],
  // Used by LCD
  languageDecorator: undefined,
  // Used by LCD
  noResultsTemplate: undefined,
  // Used by LCD
  itemsPerColumn: undefined,
  // Used by LCD
  groupByRegion: undefined,
  searchPlaceholder: 'Search for a language',
  // Used by LanguageFilter
  searchAPI: undefined
}

/**
 * ULS Public class definition
 *
 * @param {Element} element
 * @param {Object} options
 */
export default class ULS {
  constructor (element, options) {
    this.element = element
    this.options = { ...defaults, ...options }
    this.menu = htmlToElement(template)
    this.languages = this.options.languages

    for (const code in this.languages) {
      if (this.options.languages[code] === undefined) {
        // Language is unknown to ULS.
        delete this.languages[code]
      }
    }

    this.left = this.options.left
    this.top = this.options.top
    this.shown = false
    this.initialized = false
    this.shouldRecreate = false
    this.menuWidth = this.getMenuWidth()

    this.languageFilter = this.menu.querySelector('.uls-languagefilter')
    this.resultsView = this.menu.querySelector('.uls-language-list')

    this.render()
    this.listen()
    this.ready()
  };

  /**
     * A "hook" that runs after the ULS constructor.
     * At this point it is not guaranteed that the ULS has its dimensions
     * and that the languages lists are initialized.
     *
     * To use it, pass a function as the onReady parameter
     * in the options when initializing ULS.
     */
  ready () {
    if (this.options.onReady) {
      this.options.onReady.call(this)
    }
  };

  /**
     * A "hook" that runs after the ULS panel becomes visible
     * by using the show method.
     *
     * To use it, pass a function as the onVisible parameter
     * in the options when initializing ULS.
     */
  visible () {
    if (this.options.onVisible) {
      this.options.onVisible.call(this)
    }
  };

  /**
     * Calculate the position of ULS
     * Returns an object with top and left properties.
     *
     * @return {Object}
     */
  position () {
    let pos
    let top = this.top
    let left = this.left

    if (this.options.onPosition) {
      return this.options.onPosition.call(this)
    }

    // Default implementation (middle of the screen under the trigger)
    if (top === undefined) {
      pos = Object.assign({}, offset(this.element), {
        height: this.element.offsetHeight
      })
      top = pos.top + pos.height
    }

    if (left === undefined) {
      left = window.innerWidth / 2 - outerWidth(this.menu) / 2
    }

    return {
      top: top,
      left: left
    }
  };

  /**
     * Show the ULS window
     */
  show () {
    const widthClasses = {
      wide: 'uls-wide',
      medium: 'uls-medium',
      narrow: 'uls-narrow'
    }

    this.menu.classList.add(widthClasses[this.menuWidth])

    if (!this.initialized) {
      document.body.prepend(this.menu)
      this.i18n()
      this.initialized = true
    }

    const { top, left } = this.position()
    this.menu.style.top = top
    this.menu.style.left = left
    this.menu.style.display = 'block'
    this.menu.scrollIntoView()
    this.shown = true

    if (!isMobile()) {
      const event = document.createEvent('HTMLEvents')
      event.initEvent('focus', true, false)
      this.languageFilter.dispatchEvent(event)
    }

    this.visible()
  };

  i18n () {
    // if ($.i18n) {
    //   this.menu.find('[data-i18n]').i18n()
    //   this.languageFilter.prop('placeholder', $.i18n('uls-search-placeholder'))
    // }
  };

  /**
     * Hide the ULS window
     */
  hide () {
    this.menu.style.display = 'none'
    this.shown = false

    this.menu.classList.remove('uls-wide')
    this.menu.classList.remove('uls-medium')
    this.menu.classList.remove('uls-narrow')

    if (this.shouldRecreate) {
      this.recreateLanguageFilter()
    }

    if (this.options.onCancel) {
      this.options.onCancel.call(this)
    }
  };

  /**
     * Render the UI elements.
     * Does nothing by default. Can be used for customization.
     */
  render () {
    // Rendering stuff here
  };

  /**
     * Callback for results found context.
     */
  success () {
    this.resultsView.style.display = 'block'
  };

  createLanguageFilter () {
    const columnsOptions = {
      wide: 4,
      medium: 2,
      narrow: 1
    }

    const languagesCount = Object.keys(this.options.languages).length
    const lcd = new LanguageCategoryDisplay(this.resultsView, {
      languages: this.languages,
      columns: columnsOptions[this.menuWidth],
      quickList: languagesCount > 12 ? this.options.quickList : [],
      clickhandler: this.select.bind(this),
      showRegions: this.options.showRegions,
      languageDecorator: this.options.languageDecorator,
      noResultsTemplate: this.options.noResultsTemplate,
      itemsPerColumn: this.options.itemsPerColumn,
      groupByRegion: this.options.groupByRegion
    })

    const filter = new LanguageFilter(
      this.languageFilter,
      {
        lcd: lcd,
        languages: this.languages,
        ulsPurpose: this.options.ulsPurpose,
        searchAPI: this.options.searchAPI,
        onSelect: this.select.bind(this)
      })

    filter.element.addEventListener('noresults.uls', lcd.noResults.bind(lcd))
  };

  recreateLanguageFilter () {
    delete this.resultsView.dataset.lcd
    this.resultsView.empty()
    delete this.languageFilter.dataset.languagefilter
    this.createLanguageFilter()
    this.shouldRecreate = false
  };

  /**
     * Bind the UI elements with their event listeners
     */
  listen () {
    // Register all event listeners to the ULS here.
    this.element.addEventListener('click', this.click.bind(this))

    // Don't do anything if pressing on empty space in the ULS
    this.menu.addEventListener('click', function (e) {
      e.stopPropagation()
    })

    // Handle key press events on the menu
    this.menu.addEventListener('keydown', this.keypress.bind(this))

    this.createLanguageFilter()

    this.languageFilter.addEventListener('resultsfound.uls', this.success.bind(this))

    document.body.addEventListener('click', this.cancel.bind(this))
    window.addEventListener('resize', debounce(this.resize.bind(this), 250))
  };

  resize () {
    const menuWidth = this.getMenuWidth()

    if (this.menuWidth === menuWidth) {
      return
    }

    this.menuWidth = menuWidth
    this.shouldRecreate = true
    if (!this.shown) {
      this.recreateLanguageFilter()
    }
  };

  /**
     * On select handler for search results
     *
     * @param {string} langCode
     * @param {Object} event The jQuery click event
     */
  select (langCode, event) {
    this.hide()
    if (this.options.onSelect) {
      this.options.onSelect.call(this, langCode, event)
    }
  };

  /**
     * On cancel handler for the uls menu
     *
     * @param {Event} e
     */
  cancel (e) {
    if (e && (this.element !== e.target || this.element.contains(e.target))) {
      return
    }

    this.hide()
  };

  keypress (e) {
    if (!this.shown) {
      return
    }

    if (e.keyCode === 27) { // escape
      this.cancel()
      e.preventDefault()
      e.stopPropagation()
    }
  };

  click () {
    if (this.shown) {
      this.hide()
    } else {
      this.show()
    }
  };

  /**
     * Get the panel menu width parameter
     *
     * @return {string}
     */
  getMenuWidth () {
    const screenWidth = document.documentElement.clientWidth

    if (this.options.menuWidth) {
      return this.options.menuWidth
    }

    const languagesCount = Object.keys(this.options.languages).length

    if (screenWidth > 900 && languagesCount >= 48) {
      return 'wide'
    }

    if (screenWidth > 500 && languagesCount >= 24) {
      return 'medium'
    }

    return 'narrow'
  };
};
