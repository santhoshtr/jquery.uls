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

const ULS = require('./index');

(function ($) {
  'use strict'

  /* ULS PLUGIN DEFINITION */

  $.fn.uls = function (option) {
    return this.each(function () {
      const $this = $(this)
      let data = $this.data('uls')
      const options = typeof option === 'object' && option

      if (!data) {
        $this.data('uls', (data = new ULS(this, options)))
      }

      if (typeof option === 'string') {
        data[option]()
      }
    })
  }

  // Define a dummy i18n function, if jquery.i18n not integrated.
  if (!$.fn.i18n) {
    $.fn.i18n = function () { }
  }
}(jQuery))
