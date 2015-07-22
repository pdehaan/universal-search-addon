// urlbar listeners and event handlers

'use strict';

/* global Services */

function Urlbar() {
  this.urlbarUpdateTimer = null;
  this.urlbarNavigateTimer = null;
  // replaced handlers and elements
  this.replaced = {};
}
Urlbar.prototype = {
  constructor: Urlbar,
  render: function(win) {
    this.urlbar = win.document.getElementById('urlbar');

    this.replaced._autocompletepopup = this.urlbar.getAttribute('autocompletepopup');
    this.urlbar.setAttribute('autocompletepopup', 'PopupAutoCompleteRichResultUnivSearch');

    // TODO: either do something with these events, or remove them
    this.urlbar.addEventListener('focus', this);
    this.urlbar.addEventListener('blur', this);
    this.urlbar.addEventListener('keydown', this);
    this.urlbar.addEventListener('keypress', this);
    this.urlbar.addEventListener('mousedown', this);
    this.urlbar.addEventListener('paste', this);
    this.urlbar.addEventListener('drop', this);

    // Popping the urlbar element out of the DOM and back in seems to reset
    // the XBL bindings, so that our binding is applied. :-P
    this.urlbar.parentNode.insertBefore(this.urlbar, this.urlbar.nextSibling);

    window.US.broker.subscribe('iframe::autocomplete-url-clicked',
                               this.onAutocompleteURLClicked, this);
    window.US.broker.subscribe('iframe::url-selected', this.onURLSelected, this);
    window.US.broker.subscribe('popup::popupOpen', this.onPopupOpen, this);
  },
  derender: function() {
    // reconnect original popup to the urlbar
    this.urlbar.setAttribute('autocompletepopup', this.replaced._autocompletepopup);

    this.urlbar.removeEventListener('focus', this);
    this.urlbar.removeEventListener('blur', this);
    this.urlbar.removeEventListener('keydown', this);
    this.urlbar.removeEventListener('keypress', this);
    this.urlbar.removeEventListener('mousedown', this);
    this.urlbar.removeEventListener('paste', this);
    this.urlbar.removeEventListener('drop', this);

    // again, refresh the urlbar to update XBL bindings
    this.urlbar.parentNode.insertBefore(this.urlbar, this.urlbar.nextSibling);

    window.US.broker.unsubscribe('iframe::autocomplete-url-clicked',
                                 this.onAutocompleteURLClicked, this);
    window.US.broker.unsubscribe('iframe::url-selected', this.onURLSelected, this);
    window.US.broker.unsubscribe('popup::popupOpen', this.onPopupOpen, this);
  },
  onAutocompleteURLClicked: function(data) {
    if (data.resultType === 'url') {
      // it's navigable, go for it
      this.navigate(data.result);
    } else {
      // it's a search suggestion, so:
      // grab the search service, get the URL, navigate to _that_,
      // but show the search term in the urlbar
      const url = this._getSearchURLForTerm(data.result);
      this.navigate(url, data.result);
    }
  },
  // helper function that actually updates the urlbar
  _setUrlbarValue: function(url, searchTerm) {
    // gURLBar.inputField.value is the visible contents of the urlbar.
    // gURLBar.value is a separate hidden value.
    // Setting gURLBar.value also sets gURLBar.inputField.value, but not
    // vice versa.
    // So, if searchTerm is set, we want to first set the url, then replace
    // the visible input contents with the search string. If searchTerm
    // is not set, the urlbar will already show the url, so we don't need
    // to set it twice.
    // Note: this approach does work with the gURLBar.valueIsTyped logic,
    // which is convoluted but involves saving the last typed string, such
    // that, if the user has the popup open, then hits the Escape key twice,
    // the last typed value (or the last navigated value?) is shown.
    window.US.gURLBar.value = url;
    if (searchTerm) {
      window.US.gURLBar.inputField.value = searchTerm;
    }
  },
  updateUrlbar: function(url, searchTerm) {
    clearTimeout(this.urlbarUpdateTimer);
    this.urlbarUpdateTimer = setTimeout(() => {
      this._setUrlbarValue(url, searchTerm);
    }, 0);
  },
  _getSearchURLForTerm: function(searchTerm) {
    const engine = Services.search.defaultEngine;
    const url = engine.getSubmission(searchTerm).uri.spec;
    return url;
  },
  // If the user is navigating to a search, show the searchTerm, but surf to
  // the url. Otherwise, show the url and navigate to it. Because navigational
  // keys also set an update timer to show the selected item in the urlbar,
  // clear that timer, if it's set.
  navigate: function(url, searchTerm) {
    clearTimeout(this.urlbarUpdateTimer);
    this.urlbarUpdateTimer = null;

    clearTimeout(this.urlbarNavigateTimer);
    this.urlbarNavigateTimer = setTimeout(() => {
      this._setUrlbarValue(url, searchTerm);
      window.gBrowser.loadURI(url);
    }, 0);
  },
  onURLSelected: function(data) {
    console.log('onURLSelected');
    if (this.urlbarNavigateTimer) {
      return;
    }
    if (data.resultType === 'url') {
      // The user selected a URL.
      this.updateUrlbar(data.result);
    } else {
      // The user selected a search suggestion.
      // Set a timeout to show the search term in the address bar,
      // which cancels any updates queued up that haven't rendered yet.
      // if the user hits 'enter', we'll navigate to the search result page.
      const url = this._getSearchURLForTerm(data.result);
      this.updateUrlbar(url, data.result);
    }
  },
  handleEvent: function(evt) {
    const handlers = {
      'focus': this.onFocus,
      'blur': this.onBlur,
      'keydown': this.onKeyDown,
      'keypress': this.onKeyPress,
      'mousedown': this.onMouseDown,
      'paste': this.onPaste,
      'drop': this.onDrop
    };
    if (evt.type in handlers) {
      handlers[evt.type].call(this, evt);
    } else {
      console.log('handleEvent fired for unknown event ' + evt.type);
    }
  },
  _delayedCloseIfEmpty: function() {
    // debounce multiple Backspace events
    if (this._delayedCloseTimer) {
      return;
    }
    this._delayedCloseTimer = setTimeout(() => {
      this._delayedCloseTimer = null;
      if (!window.gURLBar.value) {
        window.US.popup.popup.closePopup();
      }
    }, 0);
  },
  _escKeys: ['ArrowLeft', 'ArrowRight', 'Escape'],
  _navKeys: ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Tab', 'Enter'],
  onKeyDown: function(evt) {
    if (evt.key === 'Backspace') {
      // Backspace only closes the popup if the urlbar has been emptied out.
      // We don't know if the urlbar has handled the backspace yet, so wait
      // a turn, and if the urlbar's indeed empty, close the popup.
      this._delayedCloseIfEmpty();
    } else if (evt.ctrlKey || evt.altKey || evt.metaKey || this._escKeys.indexOf(evt.key) > -1) {
      // ArrowLeft, ArrowRight, and Escape all cause the popup to close.
      // Special keys (Ctrl, Alt, Meta) could mean the user is entering a
      // hotkey combination, so, we close the popup in those cases, too.
      window.US.popup.popup.closePopup();
    } else if (this._navKeys.indexOf(evt.key) > -1) {
      // For other navigational keys, notify the iframe that the keyboard focus
      // needs to be adjusted. In the case of 'Enter', we need to wait for the
      // iframe to tell us which item is selected when that Enter hits. We also
      // need to cancel the default behavior, which will navigate to whatever
      // is currently in the urlbar.
      evt.preventDefault();
      const data = {
        key: evt.key,
        shiftKey: evt.shiftKey
      };
      window.US.broker.publish('urlbar::navigationalKey', data);
    }
  },
  onFocus: function(evt) {},
  onBlur: function(evt) {},
  onKeyPress: function(evt) {},
  onMouseDown: function(evt) {},
  onPaste: function(evt) {},
  onDrop: function(evt) {},
  onPopupOpen: function() {
    // clear any timeouts left over from the last run
    clearTimeout(this.urlbarUpdateTimer);
    this.urlbarUpdateTimer = null;
    clearTimeout(this.urlbarNavigateTimer);
    this.urlbarNavigateTimer = null;
  }
};
