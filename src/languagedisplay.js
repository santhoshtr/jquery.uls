/**
 * Universal Language Selector
 * Language category display component - Used for showing the search results,
 * grouped by regions, scripts
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
import { htmlToElement, matches, appendChildren } from './utils'

const noResultsTemplate = `<div class="uls-no-results-view">
        <h2 data-i18n="uls-no-results-found" class="uls-no-results-found-title">No results found</h2>
        <div class="uls-no-results-suggestions"></div>
        <div class="uls-no-found-more">
        <div data-i18n="uls-search-help">You can search by language name, script name, ISO code of language or you can browse by region.</div>
        </div></div>`

const defaults = {
  // List of languages to show
  languages: [],
  // Whether to group by region, defaults to true when columns > 1
  groupByRegion: 'auto',
  // How many items per column until new "row" starts
  itemsPerColumn: 8,
  // Number of columns, only 1, 2 and 4 are supported
  columns: 4,
  // Callback function for language item styling
  languageDecorator: undefined,
  // Likely candidates
  quickList: [],
  // Callback function for language selection
  clickhandler: undefined,
  // Callback function when no search results.
  // If overloaded, it can accept the search string as an argument.
  noResultsTemplate: function () {
    const noResultsEl = htmlToElement(noResultsTemplate)

    const suggestions = this.buildQuicklist().clone()
    suggestions.removeClass('hide')
      .querySelectorAll('h3')
      .data('i18n', 'uls-no-results-suggestion-title')
      .text('You may be interested in:')
      .i18n()
    const suggestionsContainer = noResultsEl.querySelector('.uls-no-results-suggestions')
    suggestionsContainer.appendChild(suggestions)
    return noResultsEl
  }
}

/**
 * Language category display
 *
 */
export default class LanguageCategoryDisplay {
  /**
    * @param {Element} element The container element to which the languages to be displayed
    * @param {Object} [options] Configuration object
    * @cfg {Object} [languages] Selectable languages. Keyed by language code, values are autonyms.
    * @cfg {string[]} [showRegions] Array of region codes to show. Default is
    *  [ 'WW', 'AM', 'EU', 'ME', 'AF', 'AS', 'PA' ]
    * @cfg {number} [itemsPerColumn] Number of languages per column.
    * @cfg {number} [columns] Number of columns for languages. Default is 4.
    * @cfg {Function} [languageDecorator] Callback function to be called when a language
    *  link is prepared - for custom decoration.
    * @cfg {Function|string[]} [quickList] The languages to display as suggestions for quick
    *  selection.
    * @cfg {Function} [clickhandler] Callback when language is selected.
    * @cfg {jQuery|Function} [noResultsTemplate]
    */
  constructor (element, options) {
    this.element = element
    this.options = { ...defaults, ...options }
    // Ensure the internal region 'all' is always present
    if (this.options.showRegions.indexOf('all') === -1) {
      this.options.showRegions.push('all')
    }

    this.element.classList.add('uls-lcd')
    this.regionLanguages = {}
    this.renderTimeout = null
    this.cachedQuicklist = []
    this.groupByRegionOverride = null

    this.render()
    this.listen()
  }

  /**
     * Adds language to the language list.
     *
     * @param {string} langCode
     * @param {string} [regionCode]
     * @return {boolean} Whether the language was known and accepted
     */
  append (langCode, regionCode) {
    let i, regions

    if (!languageData.isKnown(langCode)) {
      // Language is unknown or not in the list of languages for this context.
      return false
    }

    if (!this.isGroupingByRegionEnabled()) {
      regions = ['all']

      // Make sure we do not get duplicates
      if (this.regionLanguages.all.indexOf(langCode) > -1) {
        return true
      }
    } else {
      if (regionCode) {
        regions = [regionCode]
      } else {
        regions = languageData.getRegions(langCode)
      }
    }

    for (i = 0; i < regions.length; i++) {
      this.regionLanguages[regions[i]].push(langCode)
    }

    // Work around the bad interface, delay rendering until we have got
    // all the languages to speed up performance.
    clearTimeout(this.renderTimeout)
    this.renderTimeout = setTimeout(function () {
      this.renderRegions()
    }.bind(this), 50)

    return true
  };

  /**
 * Whether we should render languages grouped to geographic regions.
 *
 * @return {boolean}
 */
  isGroupingByRegionEnabled () {
    if (this.groupByRegionOverride !== null) {
      return this.groupByRegionOverride
    } else if (this.options.groupByRegion !== 'auto') {
      return this.options.groupByRegion
    } else {
      return this.options.columns > 1
    }
  };

  /**
 * Override the default region grouping setting.
 * This is to allow LanguageFilter to disable grouping when displaying search results.
 *
 * @param {boolean|null} val True to force grouping, false to disable, null
 * to undo override.
 */
  setGroupByRegionOverride (val) {
    this.groupByRegionOverride = val
  };

  render () {
    const quicklist = this.buildQuicklist()
    const regions = []
    const regionNames = {
      // These are fallback text when i18n library not present
      all: 'All languages', // Used if there is quicklist and no region grouping
      WW: 'Worldwide',
      SP: 'Special',
      AM: 'America',
      EU: 'Europe',
      ME: 'Middle East',
      AS: 'Asia',
      AF: 'Africa',
      PA: 'Pacific'
    }

    if (quicklist.length) {
      regions.push(quicklist)
    } else {
      // We use CSS to hide the header for 'all' when quicklist is NOT present
      this.element.classList.add('uls-lcd--no-quicklist')
    }

    this.options.showRegions.forEach((regionCode) => {
      this.regionLanguages[regionCode] = []

      const section = document.createElement('div')
      section.classList.add('uls-lcd-region-section')
      section.classList.add('hide')
      section.setAttribute('data-region', regionCode)

      const h3 = document.createElement('h3')
      h3.setAttribute('data-i18n', 'uls-region-' + regionCode)
      h3.classList.add('uls-lcd-region-title')
      h3.textContent = regionNames[regionCode]
      section.appendChild(h3)
      regions.push(section)
    })

    appendChildren(this.element, regions)

    this.i18n()
  };

  /**
 * Renders a region and displays it if it has content.
 */
  renderRegions () {
    let languages
    const lcd = this

    this.element.classList.remove('uls-no-results')
    this.element.querySelectorAll('.uls-lcd-region-section').forEach(function (region) {
      const regionCode = region.dataset.region

      if (matches(region, '.uls-lcd-quicklist')) {
        return
      }
      // TEST this!
      region.querySelectorAll('.uls-language-block').forEach(function (child) { region.removeChild(child) })

      languages = lcd.regionLanguages[regionCode]
      if (!languages || languages.length === 0) {
        region.classList.add('hide')
        return
      }

      lcd.renderRegion(
        region,
        languages,
        lcd.options.itemsPerColumn,
        lcd.options.columns
      )
      region.classList.remove('hide')

      lcd.regionLanguages[regionCode] = []
    })
  };

  /**
     * Adds given languages sorted into rows and columns into given element.
     *
     * @param {jQuery} $region Element to add language list.
     * @param {Array} languages List of language codes.
     * @param {number} itemsPerColumn How many languages fit in a column.
     * @param {number} columnsPerRow How many columns fit in a row.
     */
  renderRegion (region, languages, itemsPerColumn, columnsPerRow) {
    let columnsClasses; let i; let lastItem; let currentScript; let nextScript; let force
    const languagesCount = languages.length
    let items = []
    let columns = []
    const rows = []

    languages = languageData.sortByScriptGroup(
      languages.sort(languageData.sortByAutonym)
    )

    if (columnsPerRow === 1) {
      columnsClasses = 'twelve columns'
    } else if (columnsPerRow === 2) {
      columnsClasses = 'six columns'
    } else {
      columnsClasses = 'three columns'
    }

    if (this.options.columns === 1) {
      // For one-column narrow ULS, just render all the languages
      // in one simple list without separators or script groups
      for (i = 0; i < languagesCount; i++) {
        items.push(this.renderItem(languages[i]))
      }

      const column = document.createElement('ul')
      columnsClasses.split(' ').forEach((className) => column.classList.add(className))
      column.appendChild(items)
      columns.push(column)
      const row = document.createElement('div')
      row.classList.add('row uls-language-block')
      row.appendChild(columns)
      rows.push(row)
    } else {
      // For medium and wide ULS, clever column placement
      for (i = 0; i < languagesCount; i++) {
        force = false
        nextScript = languageData.getScriptGroupOfLanguage(languages[i + 1])

        lastItem = languagesCount - i === 1
        // Force column break if script changes and column has more than one
        // row already, but only if grouping by region
        if (i === 0 || !this.isGroupingByRegionEnabled()) {
          currentScript = languageData.getScriptGroupOfLanguage(languages[i])
        } else if (currentScript !== nextScript && items.length > 1) {
          force = true
        }
        currentScript = nextScript

        items.push(this.renderItem(languages[i]))

        if (items.length >= itemsPerColumn || lastItem || force) {
          const column = document.createElement('ul')
          columnsClasses.split(' ').forEach((className) => column.classList.add(className))
          appendChildren(column, items)
          columns.push(column)
          items = []
          if (columns.length >= columnsPerRow || lastItem) {
            const row = document.createElement('div')
            row.classList.add('row')
            row.classList.add('uls-language-block')
            appendChildren(row, columns)
            rows.push(row)
            columns = []
          }
        }
      }
    }

    appendChildren(region, rows)
  };

  /**
   * Creates dom node representing one item in language list.
   *
   * @param {string} code Language code
   * @return {Element}
  */
  renderItem (code) {
    const name = this.options.languages[code]
    const autonym = languageData.getAutonym(code) || name || code

    // Not using jQuery as this is performance hotspot
    const li = document.createElement('li')
    li.title = name
    li.setAttribute('data-code', code)

    const a = document.createElement('a')
    a.appendChild(document.createTextNode(autonym))
    a.className = 'autonym'
    a.lang = code
    a.dir = languageData.getDir(code)

    li.appendChild(a)
    if (this.options.languageDecorator) {
      this.options.languageDecorator(a, code)
    }
    return li
  }

  i18n () {
    // FIXME
    // this.element.querySelectorAll('[data-i18n]').i18n()
  };

  /**
 * Adds quicklist as a region.
 */
  quicklist () {
    this.element.querySelector('.uls-lcd-quicklist').classList.remove('hide')
  }

  buildQuicklist () {
    if (this.cachedQuicklist !== null) {
      return this.cachedQuicklist
    }

    if (typeof this.options.quickList === 'function') {
      this.options.quickList = this.options.quickList()
    }

    if (!this.options.quickList.length) {
      return this.cachedQuicklist
    }

    // Pick only the first elements, because we don't have room for more
    let quickList = this.options.quickList
    quickList = quickList.slice(0, 16)
    quickList.sort(languageData.sortByAutonym)

    const quickListSection = document.createElement('div')
    quickListSection.classList.add('uls-lcd-region-section uls-lcd-quicklist')

    const quickListSectionTitle = document.createElement('h3')
    quickListSectionTitle.setAttribute('data-i18n', 'uls-common-languages')
    quickListSectionTitle.classList.add('uls-lcd-region-title')
    quickListSectionTitle.textContent = 'Suggested languages' // This is placeholder text if jquery.i18n not present
    quickListSection.appendChild(quickListSectionTitle)

    this.renderRegion(
      quickListSection,
      quickList,
      this.options.itemsPerColumn,
      this.options.columns
    )

    // quickListSectionTitle.i18n()

    this.cachedQuicklist = quickListSection
    return this.cachedQuicklist
  }

  show () {
    if (!this.regionDivs) {
      this.render()
    }
  }

  /**
 * Called when a fresh search is started
 */
  empty () {
    this.element.classList.add('uls-lcd--no-quicklist')
    this.element.querySelectorAll('.uls-lcd-quicklist').classList.add('hide')
  }

  focus () {
    this.element.trigger('focus')
  }

  /**
 * No-results event handler
 *
 * @param {Event} event
 * @param {Object} data Information about the failed search query
 */
  noResults (event, data) {
    let $noResults

    this.element.classList.add('uls-no-results')

    this.element.querySelector('.uls-no-results-view').remove()

    if (typeof this.options.noResultsTemplate === 'function') {
      $noResults =
                this.options.noResultsTemplate.call(this, data.query)
    } else if (this.options.noResultsTemplate instanceof jQuery) {
      $noResults = this.options.noResultsTemplate
    } else {
      throw new Error('noResultsTemplate option must be ' +
                'either jQuery or function returning jQuery')
    }

    this.element.appendChild($noResults.classList.add('uls-no-results-view').i18n())
  }

  listen () {
    const lcd = this

    if (this.options.clickhandler) {
      this.element.querySelectorAll('.row li').forEach(function (item) {
        item.addEventListener('click', function (event) {
          lcd.options.clickhandler.call(this, this.dataset.code, event)
        })
      })
    }
  }
}
