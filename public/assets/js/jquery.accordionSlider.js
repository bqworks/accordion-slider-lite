/*!
* Accordion Slider - v2.8
* Homepage: https://bqworks.net/accordion-slider/
* Author: bqworks
* Author URL: https://bqworks.net/
*/
;(function(window, $) {

	"use strict";

	/*
		Static methods for Accordion Slider
	*/
	$.AccordionSlider = {

		modules: {},

		addModule: function(name, module, target) {
			if (typeof this.modules[target] === 'undefined')
				this.modules[target] = [];

			this.modules[target].push(name);

			if (target === 'accordion')
				$.extend(AccordionSlider.prototype, module);
			else if (target === 'panel')
				$.extend(AccordionSliderPanel.prototype, module);
		}
	};

	// namespace
	var NS = $.AccordionSlider.namespace = 'AccordionSlider';

	var AccordionSlider = function(instance, options) {

		// reference to the accordion jQuery object
		this.$accordion = $(instance);

		// reference to the container of the panels
		this.$panelsContainer = null;

		// reference to the container that will mask the panels
		this.$maskContainer = null;

		// holds the options specified when the accordion was instantiated
		this.options = options;

		// holds the final settings of the accordion
		this.settings = {};

		// keep a separate reference of the settings which will not be altered by breakpoints or by other means
		this.originalSettings = {};

		// the index of the currently opened panel (starts with 0)
		this.currentIndex = -1;

		// the index of the current page
		this.currentPage = 0;

		// the size, in pixels, of the accordion
		this.totalSize = 0;

		// the size of the panels' container
		this.totalPanelsSize = 0;

		// the computed size, in pixels, of the opened panel
		this.computedOpenedPanelSize = 0;

		// the computed maximum allowed size, in pixels, of the opened panel
		this.maxComputedOpenedPanelSize = 0;

		// the size, in pixels, of the collapsed panels
		this.collapsedPanelSize = 0;

		// the size, in pixels, of the closed panels
		this.closedPanelSize = 0;

		// the distance, in pixels, between the accordion's panels
		this.computedPanelDistance = 0;

		// array that contains the AccordionSliderPanel objects
		this.panels = [];

		// timer used for delaying the opening of the panel on mouse hover
		this.mouseDelayTimer = 0;

		// simple objects to be used for animation
		this.openPanelAnimation = {};
		this.closePanelsAnimation = {};

		// generate a unique ID to be used for event listening
		this.uniqueId = new Date().valueOf();

		// stores size breakpoints in an array for sorting purposes
		this.breakpoints = [];

		// indicates the current size breakpoint
		this.currentBreakpoint = -1;

		// keeps a reference to the previous number of visible panels
		this.previousVisiblePanels = -1;

		// indicates whether the accordion is currently scrolling
		this.isPageScrolling = false;

		// indicates the left or top property based on the orientation of the accordion
		this.positionProperty = 'left';

		// indicates the width or height property based on the orientation of the accordion
		this.sizeProperty = 'width';

		// keeps a reference to the ratio between the size actual size of the accordion and the set size
		this.autoResponsiveRatio = 1;

		// indicates whether the panels will overlap, based on the set panelOverlap property
		// and also based on the computed distance between panels
		this.isOverlapping = false;

		// initialize the accordion
		this._init();
	};

	AccordionSlider.prototype = {

		/*
			The starting place for the accordion
		*/
		_init: function() {
			var that = this;

			this.$accordion.removeClass('as-no-js');

			// get reference to the panels' container and 
			// create additional mask container, which will mask the panels' container
			this.$maskContainer = $('<div class="as-mask"></div>').appendTo(this.$accordion);
			this.$panelsContainer = this.$accordion.find('.as-panels').appendTo(this.$maskContainer);

			// create the 'as-panels' element if it wasn't created manually
			if (this.$panelsContainer.length === 0)
				this.$panelsContainer = $('<div class="as-panels"></div>').appendTo(this.$maskContainer);

			// initialize accordion modules
			var modules = $.AccordionSlider.modules.accordion;

			// Merge the modules' default settings with the core's default settings
			if (typeof modules !== 'undefined') {
				for (var i = 0; i < modules.length; i++) {
					var defaults = modules[i] + 'Defaults';
					
					if ( typeof this[defaults] !== 'undefined') {
						$.extend(this.defaults, this[defaults]);
					} else {
						defaults = modules[i].substring(0, 1).toLowerCase() + modules[i].substring(1) + 'Defaults';

						if (typeof this[defaults] !== 'undefined') {
							$.extend(this.defaults, this[defaults]);
						}
					}
				}
			}

			// Merge the user defined settings with the default settings
			this.settings = $.extend({}, this.defaults, this.options);

			// Initialize the modules
			if (typeof modules !== 'undefined') {
				for (var j = 0; j < modules.length; j++) {
					if (typeof this['init' + modules[j]] !== 'undefined') {
						this['init' + modules[j]]();
					}
				}
			}

			// keep a reference of the original settings and use it
			// to restore the settings when the breakpoints are used
			this.originalSettings = $.extend({}, this.settings);

			if (this.settings.shuffle === true) {
				var shuffledPanels = this.$panelsContainer.find('.as-panel').sort(function() {
					return 0.5 - Math.random();
				});
				this.$panelsContainer.empty().append(shuffledPanels);
			}

			// set a panel to be opened from the start
			this.currentIndex = this.settings.startPanel;

			if (this.currentIndex === -1)
				this.$accordion.addClass('as-closed');
			else
				this.$accordion.addClass('as-opened');

			// if a panels was not set to be opened but a page was specified,
			// set that page index to be opened
			if (this.settings.startPage !== -1)
				this.currentPage = this.settings.startPage;

			// parse the breakpoints object and store the values into an array
			// sorting them in ascending order based on the specified size
			if (this.settings.breakpoints !== null) {
				for (var sizes in this.settings.breakpoints) {
					this.breakpoints.push({size: parseInt(sizes, 10), properties:this.settings.breakpoints[sizes]});
				}

				this.breakpoints = this.breakpoints.sort(function(a, b) {
					return a.size >= b.size ? 1: -1;
				});
			}

			// prepare request animation frame
			this._prepareRAF();

			// update the accordion
			this.update();

			// if there is a panel opened at start handle that panel as if it was manually opened
			if (this.currentIndex !== -1) {
				this.$accordion.find('.as-panel').eq(this.currentIndex).addClass('as-opened');

				// fire 'panelOpen' event
				var eventObject = {type: 'panelOpen', index: this.currentIndex, previousIndex: -1};
				this.trigger(eventObject);
				if ($.isFunction(this.settings.panelOpen))
					this.settings.panelOpen.call(this, eventObject);
			}

			// listen for 'mouseenter' events
			this.on('mouseenter.' + NS, function(event) {
				var eventObject = {type: 'accordionMouseOver'};
				that.trigger(eventObject);
				if ($.isFunction(that.settings.accordionMouseOver))
					that.settings.accordionMouseOver.call(that, eventObject);
			});

			// listen for 'mouseleave' events
			this.on('mouseleave.' + NS, function(event) {
				clearTimeout(that.mouseDelayTimer);

				// close the panels
				if (that.settings.closePanelsOnMouseOut === true)
					that.closePanels();

				var eventObject = {type: 'accordionMouseOut'};
				that.trigger(eventObject);
				if ($.isFunction(that.settings.accordionMouseOut))
					that.settings.accordionMouseOut.call(that, eventObject);
			});

			// resize the accordion when the browser resizes
			$(window).on('resize.' + this.uniqueId + '.' + NS, function() {
				that.resize();
			});

			// fire the 'init' event
			this.trigger({type: 'init'});
			if ($.isFunction(this.settings.init))
				this.settings.init.call(this, {type: 'init'});
		},

		/*
			Update the accordion after a property was changed or panels were added/removed
		*/
		update: function() {
			var that = this;

			// add a class to the accordion based on the orientation
			// to be used in CSS
			if (this.settings.orientation === 'horizontal') {
				this.$accordion.removeClass('as-vertical').addClass('as-horizontal');
				this.positionProperty = 'left';
				this.sizeProperty = 'width';
			} else if (this.settings.orientation === 'vertical') {
				this.$accordion.removeClass('as-horizontal').addClass('as-vertical');
				this.positionProperty = 'top';
				this.sizeProperty = 'height';
			}

			// if the number of visible panels has change, update the current page to reflect
			// the same relative position of the panels
			if (this.settings.visiblePanels === -1) {
				this.currentPage = 0;
			} else if (this.currentIndex !== -1) {
				this.currentPage = Math.floor(this.currentIndex / this.settings.visiblePanels);
			} else if (this.settings.visiblePanels !== this.previousVisiblePanels && this.previousVisiblePanels !== -1) {
				var correctPage = Math.round((this.currentPage * this.previousVisiblePanels) / this.settings.visiblePanels);

				if (this.currentPage !== correctPage)
					this.currentPage = correctPage;
			}

			// if there is distance between the panels, the panels can't overlap
			if (this.settings.panelDistance > 0 || this.settings.panelOverlap === false) {
				this.isOverlapping = false;
				this.$accordion.removeClass('as-overlap');
			} else if (this.settings.panelOverlap === true) {
				this.isOverlapping = true;
				this.$accordion.addClass('as-overlap');
			}

			// clear inline size of the background images because the orientation might have changes
			this.$accordion.find('img.as-background, img.as-background-opened').css({'width': '', 'height': ''});

			// update panels
			this._updatePanels();

			// create or update the pagination buttons
			this._updatePaginationButtons();

			// create or remove the shadow
			if (this.settings.shadow === true) {
				this.$accordion.find('.as-panel').addClass('as-shadow');
			} else if (this.settings.shadow === false) {
				this.$accordion.find('.as-shadow').removeClass('as-shadow');
			}

			// reset the panels' container position
			this.$panelsContainer.attr('style', '');

			// set the size of the accordion
			this.resize();

			// fire the update event
			var eventObject = {type: 'update'};
			that.trigger(eventObject);
			if ($.isFunction(that.settings.update))
				that.settings.update.call(that, eventObject);
		},

		/*
			Create, remove or update panels based on the HTML specified in the accordion
		*/
		_updatePanels: function() {
			var that = this;

			// check if there are removed items in the DOM and remove the from the array of panels
			for (var i = this.panels.length - 1; i >= 0; i--) {
				if (this.$accordion.find('.as-panel[data-index="' + i + '"]').length === 0) {
					var panel = this.panels[i];

					panel.off('panelMouseOver.' + NS);
					panel.off('panelMouseOut.' + NS);
					panel.off('panelClick.' + NS);
					panel.off('imagesComplete.' + NS);
					panel.destroy();
					this.panels.splice(i, 1);
				}
			}

			// parse the DOM and create uninstantiated panels and reset the indexes
			this.$accordion.find('.as-panel').each(function(index, element) {
				var panel = $(element);

				if (typeof panel.attr('data-init') === 'undefined') {
					that._createPanel(index, panel);
				} else {
					that.panels[index].setIndex(index);
					that.panels[index].update();
				}
			});
		},

		/*
			Create an individual panel
		*/
		_createPanel: function(index, element) {
			var that = this,
				$element = $(element);

			// create a panel instance and add it to the array of panels
			var panel = new AccordionSliderPanel($element, this, index);
			this.panels.splice(index, 0, panel);

			// listen for 'panelMouseOver' events
			panel.on('panelMouseOver.' + NS, function(event) {
				if (that.isPageScrolling === true)
					return;

				if (that.settings.openPanelOn === 'hover') {
					clearTimeout(that.mouseDelayTimer);

					// open the panel, but only after a short delay in order to prevent
					// opening panels that the user doesn't intend
					that.mouseDelayTimer = setTimeout(function() {
						that.openPanel(event.index);
					}, that.settings.mouseDelay);
				}

				var eventObject = {type: 'panelMouseOver', index: index};
				that.trigger(eventObject);
				if ($.isFunction(that.settings.panelMouseOver))
					that.settings.panelMouseOver.call(that, eventObject);
			});

			// listen for 'panelMouseOut' events
			panel.on('panelMouseOut.' + NS, function(event) {
				if (that.isPageScrolling === true)
					return;

				var eventObject = {type: 'panelMouseOut', index: index};
				that.trigger(eventObject);
				if ($.isFunction(that.settings.panelMouseOut))
					that.settings.panelMouseOut.call(that, eventObject);
			});

			// listen for 'panelClick' events
			panel.on('panelClick.' + NS, function(event) {
				if (that.$accordion.hasClass('as-swiping'))
					return;
				
				if (that.settings.openPanelOn === 'click') {
					// open the panel if it's not already opened
					// and close the panels if the clicked panel is opened
					if (index !== that.currentIndex) {
						that.openPanel(event.index);
					} else {
						that.closePanels();
					}
				}

				var eventObject = {type: 'panelClick', index: index};
				that.trigger(eventObject);
				if ($.isFunction(that.settings.panelClick))
					that.settings.panelClick.call(that, eventObject);
			});

			// disable links if the panel should open on click and it wasn't opened yet
			panel.on('panelMouseDown.' + NS, function(event) {
				$(this).find('a').off('click.disablePanelLink');

				if (index !== that.currentIndex && that.settings.openPanelOn === 'click') {
					$(this).find('a').one('click.disablePanelLink', function(event) {
						event.preventDefault();
					});
				}
			});

			// listen for 'imagesComplete' events and if the images were loaded in
			// the panel that is currently opened and the size of the panel is different
			// than the currently computed size of the panel, force the re-opening of the panel
			// to the correct size
			panel.on('imagesComplete.' + NS, function(event) {
				if (event.index === that.currentIndex && event.contentSize !== that.computedOpenedPanelSize) {
					that.openPanel(event.index, true);
				}
			});
		},

		/*
			Removes all panels
		*/
		removePanels: function() {
			$.each(this.panels, function(index, element) {
				element.off('panelMouseOver.' + NS);
				element.off('panelMouseOut.' + NS);
				element.off('panelClick.' + NS);
				element.off('imagesComplete.' + NS);

				element.destroy();
			});

			this.panels.length = 0;
		},

		/*
			Called when the accordion needs to resize 
		*/
		resize: function() {
			var that = this;

			this.$maskContainer.attr('style', '');

			// prepare the accordion for responsiveness
			if (this.settings.responsive === true) {
				// if the accordion is responsive set the width to 100% and use
				// the specified width and height as a max-width and max-height
				this.$accordion.css({width: '100%', height: this.settings.height, maxWidth: this.settings.width, maxHeight: this.settings.height});

				// if an aspect ratio was not specified, set the aspect ratio
				// based on the specified width and height
				if (this.settings.aspectRatio === -1)
					this.settings.aspectRatio = this.settings.width / this.settings.height;

				this.$accordion.css('height', this.$accordion.innerWidth() / this.settings.aspectRatio);

				if (this.settings.responsiveMode === 'auto') {
					// get the accordion's size ratio based on the set size and the actual size
					this.autoResponsiveRatio = this.$accordion.innerWidth() / this.settings.width;

					this.$maskContainer.css('width', this.settings.width);

					if ( isNaN( this.settings.height ) )
						this.$maskContainer.css('height', Math.min(this.settings.width / this.settings.aspectRatio, parseInt(this.settings.height, 10) / 100 * $(window).height()));
					else
						this.$maskContainer.css('height', Math.min(this.settings.width / this.settings.aspectRatio, this.settings.height));

					// scale the mask container based on the current ratio
					if ( this.autoResponsiveRatio < 1 ) {
						this.$maskContainer.css({
							'-webkit-transform': 'scaleX(' + this.autoResponsiveRatio + ') scaleY(' + this.autoResponsiveRatio + ')',
							'-ms-transform': 'scaleX(' + this.autoResponsiveRatio + ') scaleY(' + this.autoResponsiveRatio + ')',
							'transform': 'scaleX(' + this.autoResponsiveRatio + ') scaleY(' + this.autoResponsiveRatio + ')',
							'-webkit-transform-origin': 'top left',
							'-ms-transform-origin': 'top left',
							'transform-origin': 'top left'
						});
					} else {
						this.$maskContainer.css({
							'-webkit-transform': '',
							'-ms-transform': '',
							'transform': '',
							'-webkit-transform-origin': '',
							'-ms-transform-origin': '',
							'transform-origin': ''
						});
					}
					
					this.totalSize = this.settings.orientation === "horizontal" ? this.$maskContainer.innerWidth() : this.$maskContainer.innerHeight();
				} else {
					this.totalSize = this.settings.orientation === "horizontal" ? this.$accordion.innerWidth() : this.$accordion.innerHeight();
				}
			} else {
				this.$accordion.css({width: this.settings.width, height: this.settings.height, maxWidth: '', maxHeight: ''});
				this.totalSize = this.settings.orientation === "horizontal" ? this.$accordion.innerWidth() : this.$accordion.innerHeight();
			}

			// set the size of the background images explicitly because of a bug?
			// that causes anchors not to adapt their size to the size of the image,
			// when the image size is set in percentages, which causes the total size
			// of the panel to be bigger than it should
			if (this.settings.orientation === 'horizontal')
				this.$accordion.find('img.as-background, img.as-background-opened').css('height', this.$panelsContainer.innerHeight());
			else
				this.$accordion.find('img.as-background, img.as-background-opened').css('width', this.$panelsContainer.innerWidth());

			// set the initial computedPanelDistance to the value defined in the options
			this.computedPanelDistance = this.settings.panelDistance;

			// parse computedPanelDistance and set it to a pixel value
			if (typeof this.computedPanelDistance === 'string') {
				if (this.computedPanelDistance.indexOf('%') !== -1) {
					this.computedPanelDistance = this.totalSize * (parseInt(this.computedPanelDistance, 10)/ 100);
				} else if (this.computedPanelDistance.indexOf('px') !== -1) {
					this.computedPanelDistance = parseInt(this.computedPanelDistance, 10);
				}
			}

			// set the size, in pixels, of the closed panels
			this.closedPanelSize = (this.totalSize - (this.getVisiblePanels() - 1) * this.computedPanelDistance) / this.getVisiblePanels();

			// round the value
			this.closedPanelSize = Math.floor(this.closedPanelSize);

			// set the initial computedOpenedPanelSize to the value defined in the options
			this.computedOpenedPanelSize = this.settings.openedPanelSize;

			// if the panels are set to open to their maximum size,
			// parse maxComputedOpenedPanelSize and set it to a pixel value
			if (this.settings.openedPanelSize === 'max') {
				// set the initial maxComputedOpenedPanelSize to the value defined in the options
				this.maxComputedOpenedPanelSize = this.settings.maxOpenedPanelSize;

				if (typeof this.maxComputedOpenedPanelSize === 'string') {
					if (this.maxComputedOpenedPanelSize.indexOf('%') !== -1) {
						this.maxComputedOpenedPanelSize = this.totalSize * (parseInt(this.maxComputedOpenedPanelSize, 10)/ 100);
					} else if (this.maxComputedOpenedPanelSize.indexOf('px') !== -1) {
						this.maxComputedOpenedPanelSize = parseInt(this.maxComputedOpenedPanelSize, 10);
					}
				}
			}

			// parse computedOpenedPanelSize and set it to a pixel value
			if (typeof this.computedOpenedPanelSize === 'string') {
				if (this.computedOpenedPanelSize.indexOf('%') !== -1) {
					this.computedOpenedPanelSize = this.totalSize * (parseInt(this.computedOpenedPanelSize, 10)/ 100);
				} else if (this.computedOpenedPanelSize.indexOf('px') !== -1) {
					this.computedOpenedPanelSize = parseInt(this.computedOpenedPanelSize, 10);
				} else if (this.computedOpenedPanelSize === 'max' && this.currentIndex !== -1) {
					var contentSize = this.getPanelAt(this.currentIndex).getContentSize();
					this.computedOpenedPanelSize = contentSize === 'loading' ? this.closedPanelSize : Math.min(contentSize, this.maxComputedOpenedPanelSize);
				}
			}

			// set the size, in pixels, of the collapsed panels
			this.collapsedPanelSize = (this.totalSize - this.computedOpenedPanelSize - (this.getVisiblePanels() - 1) * this.computedPanelDistance) / (this.getVisiblePanels() - 1);

			// round the values
			this.computedOpenedPanelSize = Math.floor(this.computedOpenedPanelSize);
			this.collapsedPanelSize = Math.floor(this.collapsedPanelSize);

			// get the total size of the panels' container
			this.totalPanelsSize = this.closedPanelSize * this.getTotalPanels() + this.computedPanelDistance * (this.getTotalPanels() - 1);

			this.$panelsContainer.css(this.sizeProperty, this.totalPanelsSize);

			// recalculate the totalSize due to the fact that rounded sizes can cause incorrect positioning
			// since the actual size of all panels from a page might be smaller than the whole width of the accordion
			this.totalSize = this.closedPanelSize * this.getVisiblePanels() + this.computedPanelDistance * (this.getVisiblePanels() - 1);

			if (this.settings.responsiveMode === 'custom' || this.settings.responsive === false) {
				this.$accordion.css(this.sizeProperty, this.totalSize);
			} else {
				this.$accordion.css(this.sizeProperty, this.totalSize * this.autoResponsiveRatio);
				this.$maskContainer.css(this.sizeProperty, this.totalSize);
			}

			// if there are multiple pages, set the correct position of the panels' container
			if (this.settings.visiblePanels !== -1) {
				var cssObj = {},
					targetPosition = - (this.totalSize + this.computedPanelDistance) * this.currentPage;
				
				if (this.currentPage === this.getTotalPages() - 1)
					targetPosition = - (this.closedPanelSize * this.getTotalPanels() + this.computedPanelDistance * (this.getTotalPanels() - 1) - this.totalSize);

				cssObj[this.positionProperty] = targetPosition;
				this.$panelsContainer.css(cssObj);
			}

			// calculate missing panels for the last page of panels
			var missingPanels = (this.currentPage === this.getTotalPages() - 1) && (this.getTotalPanels() % this.settings.visiblePanels) !== 0 ?
								this.settings.visiblePanels - this.getTotalPanels() % this.settings.visiblePanels :
								0;

			// set the position and size of each panel
			$.each(this.panels, function(index, element) {
				// get the position of the panel based on the currently selected index and the panel's index
				var position;

				if (that.currentIndex === -1) {
					position = index * (that.closedPanelSize + that.computedPanelDistance);
				} else if (that.settings.visiblePanels === -1) {
					position = index * (that.collapsedPanelSize + that.computedPanelDistance) + (index > that.currentIndex ? that.computedOpenedPanelSize - that.collapsedPanelSize : 0);
				} else {
					if (that._getPageOfPanel(index) === that.currentPage) {
						position = that.currentPage * (that.totalSize + that.computedPanelDistance) +
									(index + missingPanels - that.currentPage * that.settings.visiblePanels) * (that.collapsedPanelSize + that.computedPanelDistance) +
									(index > that.currentIndex ? that.computedOpenedPanelSize - that.collapsedPanelSize : 0);

						if (that.currentPage === that.getTotalPages() - 1 && missingPanels !== 0)
							position -= (that.getTotalPages() - that.getTotalPanels() / that.settings.visiblePanels) * (that.totalSize + that.computedPanelDistance);
					} else {
						position = index * (that.closedPanelSize + that.computedPanelDistance);
					}
				}

				element.setPosition(position);
				
				// get the size of the panel based on the state of the panel (opened, closed or collapsed)
				if (that.isOverlapping === false) {
					var size = (that.currentIndex === -1 || (that.settings.visiblePanels !== -1 && that._getPageOfPanel(index) !== that.currentPage)) ?
								(that.closedPanelSize) :
								(index === that.currentIndex ? that.computedOpenedPanelSize : that.collapsedPanelSize);
					element.setSize(size);
				}
			});

			// check if the current window width is bigger than the biggest breakpoint
			// and if necessary reset the properties to the original settings
			// if the window width is smaller than a certain breakpoint, apply the settings specified
			// for that breakpoint but only after merging them with the original settings
			// in order to make sure that only the specified settings for the breakpoint are applied
			if (this.settings.breakpoints !== null && this.breakpoints.length > 0) {
				if ($(window).width() > this.breakpoints[this.breakpoints.length - 1].size && this.currentBreakpoint !== -1) {
					this.currentBreakpoint = -1;
					this._setProperties(this.originalSettings, false);
				} else {
					for (var i = 0, n = this.breakpoints.length; i < n; i++) {
						if ($(window).width() <= this.breakpoints[i].size) {
							if (this.currentBreakpoint !== this.breakpoints[i].size) {

								var eventObject = {type: 'breakpointReach', size: this.breakpoints[i].size, settings: this.breakpoints[i].properties};
								that.trigger(eventObject);
								if ($.isFunction(that.settings.breakpointReach))
									that.settings.breakpointReach.call(that, eventObject);

								this.currentBreakpoint = this.breakpoints[i].size;
								var settings = $.extend({}, this.originalSettings, this.breakpoints[i].properties);
								this._setProperties(settings, false);
							}
							break;
						}
					}
				}
			}
		},

		/*
			Set properties on runtime
		*/
		_setProperties: function(properties, store) {
			// parse the properties passed as an object
			for (var prop in properties) {
				// if the number of visible panels is changed, store a reference of the previous value
				// which will be used to move the panels to the corresponding page
				if (prop === 'visiblePanels' && this.settings.visiblePanels !== -1)
					this.previousVisiblePanels = this.settings.visiblePanels;

				this.settings[prop] = properties[prop];

				// alter the original settings as well unless 'false' is passed to the 'store' parameter
				if (store !== false)
					this.originalSettings[prop] = properties[prop];
			}

			this.update();
		},

		/*
			Destroy the Accordion Slider instance
		*/
		destroy: function() {
			// remove the stored reference to this instance
			this.$accordion.removeData('accordionSlider');

			// remove inline style
			this.$accordion.attr('style', '');
			this.$panelsContainer.attr('style', '');

			// detach event handlers
			this.off('mouseenter.' + NS);
			this.off('mouseleave.' + NS);

			$(window).off('resize.' + this.uniqueId + '.' + NS);

			// stop animations
			this._stopPanelsAnimation(this.openPanelAnimation);
			this._stopPanelsAnimation(this.closePanelsAnimation);

			// destroy modules
			var modules = $.AccordionSlider.modules.accordion;

			if (typeof modules !== 'undefined')
				for (var i = 0; i < modules.length; i++) {
					if (typeof this['destroy' + modules[i]] !== 'undefined')
						this['destroy' + modules[i]]();
				}

			// destroy all panels
			this.removePanels();

			// move the panels from the mask container back in the main accordion container
			this.$panelsContainer.appendTo(this.$accordion);

			// remove elements that were created by the script
			this.$maskContainer.remove();
			this.$accordion.find('.as-pagination-buttons').remove();
		},

		/*
			Attach an event handler to the accordion
		*/
		on: function(type, callback) {
			return this.$accordion.on(type, callback);
		},

		/*
			Detach an event handler
		*/
		off: function(type) {
			return this.$accordion.off(type);
		},

		/*
			Trigger an event on the accordion
		*/
		trigger: function(data) {
			return this.$accordion.triggerHandler(data);
		},

		/*
			Return the panel at the specified index
		*/
		getPanelAt: function(index) {
			return this.panels[index];
		},

		/*
			Return the index of the currently opened panel
		*/
		getCurrentIndex: function() {
			return this.currentIndex;
		},

		/*
			Return the total amount of panels
		*/
		getTotalPanels: function() {
			return this.panels.length;
		},

		/*
			Open the next panel
		*/
		nextPanel: function() {
			var index = (this.currentIndex >= this.getTotalPanels() - 1) ? 0 : (this.currentIndex + 1);
			this.openPanel(index);
		},

		/*
			Open the previous panel
		*/
		previousPanel: function() {
			var index = this.currentIndex <= 0 ? (this.getTotalPanels() - 1) : (this.currentIndex - 1);
			this.openPanel(index);
		},

		/*
			Animate the panels using request animation frame
		*/
		_animatePanels: function(target, args) {
			var startTime = new Date().valueOf(),
				progress = 0;

			target.isRunning = true;
			target.timer = window.requestAnimationFrame(_animate);

			function _animate() {
				if (progress < 1) {
					// get the progress by calculating the elapsed time
					progress = (new Date().valueOf() - startTime) / args.duration;

					if (progress > 1)
						progress = 1;

					// apply swing easing
					progress = 0.5 - Math.cos(progress * Math.PI) / 2;

					args.step(progress);

					target.timer = window.requestAnimationFrame(_animate);
				} else {
					args.complete();

					target.isRunning = false;
					window.cancelAnimationFrame(target.timer);
				}
			}
		},

		/*
			Stop running panel animations
		*/
		_stopPanelsAnimation: function(target) {
			if (typeof target.isRunning !== 'undefined' && target.isRunning === true) {
				target.isRunning = false;
				window.cancelAnimationFrame(target.timer);
			}
		},

		/*
			Check if window.requestAnimationFrame exists in the browser and if it doesn't, 
			try alternative function names or implement window.requestAnimationFrame using window.setTimeout
		*/
		_prepareRAF: function() {
			if (typeof window.requestAnimationFrame === 'undefined') {
				var vendorPrefixes = ['webkit', 'moz'];

				for(var i = 0; i < vendorPrefixes.length; i++) {
					window.requestAnimationFrame = window[vendorPrefixes[i] + 'RequestAnimationFrame'];
					window.cancelAnimationFrame = window.cancelAnimationFrame || window[vendorPrefixes[i] + 'CancelAnimationFrame'] || window[vendorPrefixes[i] + 'CancelRequestAnimationFrame'];
				}
			}

			// polyfill inspired from Erik Moller
			if (typeof window.requestAnimationFrame === 'undefined') {
				var lastTime = 0;

				window.requestAnimationFrame = function(callback, element) {
					var currentTime = new Date().valueOf(),
						timeToCall = Math.max(0, 16 - (currentTime - lastTime));

					var id = window.setTimeout(function() {
						callback(currentTime + timeToCall);
					}, timeToCall);

					lastTime = currentTime + timeToCall;

					return id;
				};

				window.cancelAnimationFrame = function(id) {
					clearTimeout(id);
				};
			}
		},

		/*
			Open the panel at the specified index
		*/
		openPanel: function(index, force) {
			if (index === this.currentIndex && force !== true)
				return;

			// remove the "closed" class and add the "opened" class, which indicates
			// that the accordion has an opened panel
			if (this.$accordion.hasClass('as-opened') === false) {
				this.$accordion.removeClass('as-closed');
				this.$accordion.addClass('as-opened');
			}

			var previousIndex = this.currentIndex;

			this.currentIndex = index;
			
			// synchronize the page with the selected panel by navigating to the page that
			// contains the panel if necessary.
			// if the last page is already selected and the selected panel is on this last page 
			// don't navigate to a different page no matter what panel is selected and whether
			// the panel actually belongs to the previous page
			if (this.settings.visiblePanels !== -1 && !(this.currentPage === this.getTotalPages() - 1 && index >= this.getTotalPanels() - this.settings.visiblePanels)) {
				var page = Math.floor(this.currentIndex / this.settings.visiblePanels);

				if (page !== this.currentPage)
					this.gotoPage(page);

				// reset the current index because when the closePanels was called inside gotoPage the current index became -1
				this.currentIndex = index;
			}

			var that = this,
				targetSize = [],
				targetPosition = [],
				startSize = [],
				startPosition = [],
				animatedPanels = [],
				firstPanel = this._getFirstPanelFromPage(),
				lastPanel = this._getLastPanelFromPage(),
				counter = 0;

			this.$accordion.find('.as-panel.as-opened').removeClass('as-opened');
			this.$accordion.find('.as-panel').eq(this.currentIndex).addClass('as-opened');

			// check if the panel needs to open to its maximum size and recalculate
			// the size of the opened panel and the size of the collapsed panel
			if (this.settings.openedPanelSize === 'max') {
				var contentSize = this.getPanelAt(this.currentIndex).getContentSize();
				this.computedOpenedPanelSize = contentSize === 'loading' ? this.closedPanelSize : Math.min(contentSize, this.maxComputedOpenedPanelSize);

				this.collapsedPanelSize = (this.totalSize - this.computedOpenedPanelSize - (this.getVisiblePanels() - 1) * this.computedPanelDistance) / (this.getVisiblePanels() - 1);
			}

			// get the starting and target position and size of each panel
			for (var i = firstPanel; i <= lastPanel; i++) {
				var panel = this.getPanelAt(i);
				
				startPosition[i] = panel.getPosition();
				targetPosition[i] = this.currentPage * (this.totalSize + this.computedPanelDistance) +
									counter * (this.collapsedPanelSize + this.computedPanelDistance) +
									(i > this.currentIndex ? this.computedOpenedPanelSize - this.collapsedPanelSize : 0);

				// the last page might contain less panels than the set number of visible panels.
				// in this situation, the last page will contain some panels from the previous page
				// and this requires the panels from the last page to be positioned differently than
				// the rest of the panels. this requires some amendments to the position of the last panels
				// by replacing the current page index with a float number: this.getTotalPanels() / this.settings.visiblePanels, 
				// which would represent the actual number of existing pages.
				// here we subtract the float number from the formal number of pages in order to calculate
				// how much length it's necessary to subtract from the initially calculated value
				if (this.settings.visiblePanels !== -1 && this.currentPage === this.getTotalPages() - 1)
					targetPosition[i] -= (this.getTotalPages() - this.getTotalPanels() / this.settings.visiblePanels) * (this.totalSize + this.computedPanelDistance);

				// check if the panel's position needs to change
				if (targetPosition[i] !== startPosition[i])
					animatedPanels.push(i);

				if (this.isOverlapping === false) {
					startSize[i] = panel.getSize();
					targetSize[i] = i === this.currentIndex ? this.computedOpenedPanelSize : this.collapsedPanelSize;

					// check if the panel's size needs to change
					if (targetSize[i] !== startSize[i] && $.inArray(i, animatedPanels) === -1)
						animatedPanels.push(i);
				}

				counter++;
			}

			var totalPanels = animatedPanels.length;

			// stop the close panels animation if it's on the same page
			if (this.closePanelsAnimation.page === this.currentPage)
				this._stopPanelsAnimation(this.closePanelsAnimation);

			// stop any running animations
			this._stopPanelsAnimation(this.openPanelAnimation);

			// assign the current page
			this.openPanelAnimation.page = this.currentPage;

			// animate the panels
			this._animatePanels(this.openPanelAnimation, {
				duration: this.settings.openPanelDuration,
				step: function(progress) {
					for (var i = 0; i < totalPanels; i++) {
						var value = animatedPanels[i],
							panel = that.getPanelAt(value);

						panel.setPosition(progress * (targetPosition[value] - startPosition[value]) + startPosition[value]);

						if (that.isOverlapping === false)
							panel.setSize(progress * (targetSize[value] - startSize[value]) + startSize[value]);
					}
				},
				complete: function() {
					// fire 'panelOpenComplete' event
					var eventObject = {type: 'panelOpenComplete', index: that.currentIndex};
					that.trigger(eventObject);
					if ($.isFunction(that.settings.panelOpenComplete))
						that.settings.panelOpenComplete.call(that, eventObject);
				}
			});

			// fire 'panelOpen' event
			var eventObject = {type: 'panelOpen', index: index, previousIndex: previousIndex};
			this.trigger(eventObject);
			if ($.isFunction(this.settings.panelOpen))
				this.settings.panelOpen.call(this, eventObject);
		},

		/*
			Close the panels
		*/
		closePanels: function() {
			var previousIndex = this.currentIndex;

			this.currentIndex = -1;

			// remove the "opened" class and add the "closed" class, which indicates
			// that the accordion is closed
			if (this.$accordion.hasClass('as-closed') === false) {
				this.$accordion.removeClass('as-opened');
				this.$accordion.addClass('as-closed');
			}

			// remove the "opened" class from the previously opened panel
			this.$accordion.find('.as-panel.as-opened').removeClass('as-opened');

			clearTimeout(this.mouseDelayTimer);

			var that = this,
				targetSize = [],
				targetPosition = [],
				startSize = [],
				startPosition = [],
				firstPanel = this._getFirstPanelFromPage(),
				lastPanel = this._getLastPanelFromPage(),
				counter = 0;

			// get the starting and target size and position of each panel
			for (var i = firstPanel; i <= lastPanel; i++) {
				var panel = this.getPanelAt(i);
				
				startPosition[i] = panel.getPosition();
				targetPosition[i] = this.currentPage * (this.totalSize + this.computedPanelDistance) + counter * (this.closedPanelSize + this.computedPanelDistance);
				
				// same calculations as in openPanel
				if (this.settings.visiblePanels !== -1 && this.currentPage === this.getTotalPages() - 1)
					targetPosition[i] -= (this.getTotalPages() - this.getTotalPanels() / this.settings.visiblePanels) * (this.totalSize + this.computedPanelDistance);

				if (this.isOverlapping === false) {
					startSize[i] = panel.getSize();
					targetSize[i] = this.closedPanelSize;
				}

				counter++;
			}

			// stop the open panel animation if it's on the same page
			if (this.openPanelAnimation.page === this.currentPage)
				this._stopPanelsAnimation(this.openPanelAnimation);

			// stop any running animations
			this._stopPanelsAnimation(this.closePanelsAnimation);

			// assign the current page
			this.closePanelsAnimation.page = this.currentPage;

			// animate the panels
			this._animatePanels(this.closePanelsAnimation, {
				duration: this.settings.closePanelDuration,
				step: function(progress) {
					for (var i = firstPanel; i <= lastPanel; i++) {
						var panel = that.getPanelAt(i);

						panel.setPosition(progress * (targetPosition[i] - startPosition[i]) + startPosition[i]);

						if (that.isOverlapping === false)
							panel.setSize(progress * (targetSize[i] - startSize[i]) + startSize[i]);
					}
				},
				complete: function() {
					// fire 'panelsCloseComplete' event
					var eventObject = {type: 'panelsCloseComplete', previousIndex: previousIndex};
					that.trigger(eventObject);
					if ($.isFunction(that.settings.panelsCloseComplete))
						that.settings.panelsCloseComplete.call(that, eventObject);
				}
			});

			// fire 'panelsClose' event
			var eventObject = {type: 'panelsClose', previousIndex: previousIndex};
			this.trigger(eventObject);
			if ($.isFunction(this.settings.panelsClose))
				this.settings.panelsClose.call(this, eventObject);
		},

		/*
			Return the number of visible panels
		*/
		getVisiblePanels: function() {
			return this.settings.visiblePanels === -1 ? this.getTotalPanels() : this.settings.visiblePanels;
		},

		/*
			Return the total number of pages
		*/
		getTotalPages: function() {
			if (this.settings.visiblePanels === -1)
				return 1;
			
			return Math.ceil(this.getTotalPanels() / this.settings.visiblePanels);
		},

		/*
			Return the current page
		*/
		getCurrentPage: function() {
			return this.settings.visiblePanels === -1 ? 0 : this.currentPage;
		},

		/*
			Navigate to the indicated page
		*/
		gotoPage: function(index) {
			// close any opened panels before scrolling to a different page
			if (this.currentIndex !== -1)
				this.closePanels();

			this.currentPage = index;

			this.isPageScrolling = true;

			var that = this,
				animObj = {},
				targetPosition = - (index * this.totalSize + this.currentPage * this.computedPanelDistance);
			
			if (this.currentPage === this.getTotalPages() - 1)
				targetPosition = - (this.totalPanelsSize - this.totalSize);

			animObj[this.positionProperty] = targetPosition;

			// fire 'pageScroll' event
			var eventObject = {type: 'pageScroll', index: this.currentPage};
			this.trigger(eventObject);
			if ($.isFunction(this.settings.pageScroll))
				this.settings.pageScroll.call(this, eventObject);

			this.$panelsContainer.stop().animate(animObj, this.settings.pageScrollDuration, this.settings.pageScrollEasing, function() {
				that.isPageScrolling = false;

				// fire 'pageScrollComplete' event
				var eventObject = {type: 'pageScrollComplete', index: that.currentPage};
				that.trigger(eventObject);
				if ($.isFunction(that.settings.pageScrollComplete))
					that.settings.pageScrollComplete.call(that, eventObject);
			});
		},

		/*
			Navigate to the next page
		*/
		nextPage: function() {
			var index = (this.currentPage >= this.getTotalPages() - 1) ? 0 : (this.currentPage + 1);
			this.gotoPage(index);
		},

		/*
			Navigate to the previous page
		*/
		previousPage: function() {
			var index = this.currentPage <= 0 ? (this.getTotalPages() - 1) : (this.currentPage - 1);
			this.gotoPage(index);
		},

		/*
			Calculate and return the first panel from the current page
		*/
		_getFirstPanelFromPage: function() {
			if (this.settings.visiblePanels === -1) {
				return 0;
			} else if (this.currentPage === this.getTotalPages() - 1 && this.currentPage !== 0) {
				return this.getTotalPanels() - this.settings.visiblePanels;
			} else {
				return this.currentPage * this.settings.visiblePanels;
			}
		},

		/*
			Calculate and return the last panel from the current page
		*/
		_getLastPanelFromPage: function() {
			if (this.settings.visiblePanels === -1) {
				return this.getTotalPanels() - 1;
			} else if (this.currentPage === this.getTotalPages() - 1) {
				return this.getTotalPanels() - 1;
			} else {
				return (this.currentPage + 1) * this.settings.visiblePanels - 1;
			}
		},

		/*
			Return the page that the specified panel belongs to
		*/
		_getPageOfPanel: function(index) {
			if (this.currentPage === this.getTotalPages() - 1 && index >= this.getTotalPanels() - this.settings.visiblePanels)
				return this.getTotalPages() - 1;

			return Math.floor(index / this.settings.visiblePanels);
		},

		/*
			Create or update the pagination buttons
		*/
		_updatePaginationButtons: function() {
			var paginationButtons = this.$accordion.find('.as-pagination-buttons'),
				that = this,
				totalPages = this.getTotalPages();

			// remove the buttons if there are no more pages
			if (totalPages <= 1 && paginationButtons.length !== 0) {
				paginationButtons.remove();
				paginationButtons.off('click.' + NS, '.as-pagination-button');
				this.off('pageScroll.' + NS);
				
				this.$accordion.removeClass('as-has-buttons');
			// if there are pages and the buttons were not created yet, create them now
			} else if (totalPages > 1 && paginationButtons.length === 0) {
				// create the buttons' container
				paginationButtons = $('<div class="as-pagination-buttons"></div>').appendTo(this.$accordion);

				// create the buttons
				for (var i = 0; i < this.getTotalPages(); i++) {
					$('<div class="as-pagination-button"></div>').appendTo(paginationButtons);
				}

				// listen for button clicks 
				paginationButtons.on('click.' + NS, '.as-pagination-button', function() {
					that.gotoPage($(this).index());
				});

				// set the initially selected button
				paginationButtons.find('.as-pagination-button').eq(this.currentPage).addClass('as-selected');

				// select the corresponding panel when the page changes and change the selected button
				this.on('pageScroll.' + NS, function(event) {
					paginationButtons.find('.as-selected').removeClass('as-selected');
					paginationButtons.find('.as-pagination-button').eq(event.index).addClass('as-selected');
				});

				this.$accordion.addClass('as-has-buttons');

			// update the buttons if they already exist but their number differs from
			// the number of existing pages
			} else if (totalPages > 1 && paginationButtons.length !== 0) {
				paginationButtons.empty();

				// create the buttons
				for (var j = 0; j < this.getTotalPages(); j++) {
					$('<div class="as-pagination-button"></div>').appendTo(paginationButtons);
				}

				// change the selected the buttons
				paginationButtons.find('.as-selected').removeClass('as-selected');
				paginationButtons.find('.as-pagination-button').eq(this.currentPage).addClass('as-selected');
			}
		},

		/*
			The default options of the accordion
		*/
		defaults: {
			width: 800,
			height: 400,
			responsive: true,
			responsiveMode: 'auto',
			aspectRatio: -1,
			orientation: 'horizontal',
			startPanel: -1,
			openedPanelSize: 'max',
			maxOpenedPanelSize: '80%',
			openPanelOn: 'hover',
			closePanelsOnMouseOut: true,
			mouseDelay: 200,
			panelDistance: 0,
			openPanelDuration: 700,
			closePanelDuration: 700,
			pageScrollDuration: 500,
			pageScrollEasing: 'swing',
			breakpoints: null,
			visiblePanels: -1,
			startPage: 0,
			shadow: true,
			shuffle: false,
			panelOverlap: true,
			init: function() {},
			update: function() {},
			accordionMouseOver: function() {},
			accordionMouseOut: function() {},
			panelClick: function() {},
			panelMouseOver: function() {},
			panelMouseOut: function() {},
			panelOpen: function() {},
			panelsClose: function() {},
			pageScroll: function() {},
			panelOpenComplete: function() {},
			panelsCloseComplete: function() {},
			pageScrollComplete: function() {},
			breakpointReach: function() {}
		}
	};

	var AccordionSliderPanel = function(panel, accordion, index) {

		// reference to the panel jQuery object
		this.$panel = panel;

		// reference to the accordion object
		this.accordion = accordion;

		// reference to the global settings of the accordion
		this.settings = this.accordion.settings;

		// set a namespace for the panel
		this.panelNS =  'AccordionSliderPanel' + index + '.' + NS;

		this.isLoading = false;
		this.isLoaded = false;

		// set the index of the panel
		this.setIndex(index);

		// initialize the panel
		this._init();
	};

	AccordionSliderPanel.prototype = {

		/*
			The starting point for the panel
		*/
		_init: function() {
			var that = this;

			this.$panel.attr('data-init', true);

			// listen for 'mouseenter' events
			this.on('mouseenter.' + this.panelNS, function() {
				that.trigger({type: 'panelMouseOver.' + NS, index: that.index});
			});

			// listen for 'mouseleave' events
			this.on('mouseleave.' + this.panelNS, function() {
				that.trigger({type: 'panelMouseOut.' + NS, index: that.index});
			});

			// listen for 'click' events
			this.on('click.' + this.panelNS, function() {
				that.trigger({type: 'panelClick.' + NS, index: that.index});
			});

			// listen for 'mousedown' events
			this.on('mousedown.' + this.panelNS, function() {
				that.trigger({type: 'panelMouseDown.' + NS, index: that.index});
			});

			// set position and size properties
			this.update();

			// initialize panel modules
			var modules = $.AccordionSlider.modules.panel;

			if (typeof modules !== 'undefined')
				for (var i = 0; i < modules.length; i++) {
					if (typeof this['init' + modules[i]] !== 'undefined')
						this['init' + modules[i]]();
				}
		},

		/*
			Update the panel
		*/
		update: function() {
			// get the new position and size properties
			this.positionProperty = this.settings.orientation === 'horizontal' ? 'left' : 'top';
			this.sizeProperty = this.settings.orientation === 'horizontal' ? 'width' : 'height';

			// reset the current size and position
			this.$panel.css({top: '', left: '', width: '', height: ''});
		},

		/*
			Destroy the panel
		*/
		destroy: function() {
			// detach all event listeners
			this.off('mouseenter.' + this.panelNS);
			this.off('mouseleave.' + this.panelNS);
			this.off('click.' + this.panelNS);
			this.off('mousedown.' + this.panelNS);

			// clean the element from attached styles and data
			this.$panel.attr('style', '');
			this.$panel.removeAttr('data-init');
			this.$panel.removeAttr('data-index');

			// destroy panel modules
			var modules = $.AccordionSlider.modules.panel;

			if (typeof modules !== 'undefined')
				for (var i = 0; i < modules.length; i++) {
					if (typeof this['destroy' + modules[i]] !== 'undefined')
						this['destroy' + modules[i]]();
				}
		},

		/*
			Return the index of the panel
		*/
		getIndex: function() {
			return this.index;
		},

		/*
			Set the index of the panel
		*/
		setIndex: function(index) {
			this.index = index;
			this.$panel.attr('data-index', this.index);
		},

		/*
			Return the position of the panel
		*/
		getPosition: function() {
			return parseInt(this.$panel.css(this.positionProperty), 10);
		},

		/*
			Set the position of the panel
		*/
		setPosition: function(value) {
			this.$panel.css(this.positionProperty, value);
		},

		/*
			Return the size of the panel
		*/
		getSize: function() {
			return parseInt(this.$panel.css(this.sizeProperty), 10);
		},

		/*
			Set the size of the panel
		*/
		setSize: function(value) {
			this.$panel.css(this.sizeProperty, value);
		},

		/*
			Get the real size of the panel's content
		*/
		getContentSize: function() {
			// check if there are loading images
			if (this.isLoaded === false)
				if (this.checkImagesComplete() === 'loading')
					return 'loading';

			this.$panel.find( '.as-opened' ).css( 'display', 'none' );

			var size = this.sizeProperty === 'width' ? this.$panel[0].scrollWidth : this.$panel[0].scrollHeight;
			
			this.$panel.find( '.as-opened' ).css( 'display', '' );

			return size;
		},

		/*
			Check the status of all images from the panel
		*/
		checkImagesComplete: function() {
			if (this.isLoading === true)
				return 'loading';

			var that = this,
				status = 'complete';

			// check if there is any unloaded image inside the panel
			this.$panel.find('img').each(function(index) {
				var image = $(this)[0];

				if (image.complete === false || typeof $(this).attr('data-src') !== 'undefined')
					status = 'loading';
			});

			// continue checking until all images have loaded
			if (status === 'loading') {
				this.isLoading = true;

				var checkImage = setInterval(function() {
					var loaded = true;

					that.$panel.find('img').each(function(index) {
						var image = $(this)[0];

						if (image.complete === false || typeof $(this).attr('data-src') !== 'undefined')
							loaded = false;
					});

					if (loaded === true) {
						that.isLoading = false;
						that.isLoaded = true;
						clearInterval(checkImage);
						that.trigger({type: 'imagesComplete.' + NS, index: that.index, contentSize: that.getContentSize()});
					}
				}, 100);
			} else {
				this.isLoaded = true;
			}

			return status;
		},

		/*
			Attach an event handler to the panel
		*/
		on: function(type, callback) {
			return this.$panel.on(type, callback);
		},

		/*
			Detach an event handler to the panel
		*/
		off: function(type) {
			return this.$panel.off(type);
		},

		/*
			Trigger an event on the panel
		*/
		trigger: function(data) {
			return this.$panel.triggerHandler(data);
		}
	};

	window.AccordionSlider = AccordionSlider;
	window.AccordionSliderPanel = AccordionSliderPanel;

	$.fn.accordionSlider = function(options) {
		var args = Array.prototype.slice.call(arguments, 1);

		return this.each(function() {
			// instantiate the accordion or alter it
			if (typeof $(this).data('accordionSlider') === 'undefined') {
				var newInstance = new AccordionSlider(this, options);

				// store a reference to the instance created
				$(this).data('accordionSlider', newInstance);
			} else if (typeof options !== 'undefined') {
				var	currentInstance = $(this).data('accordionSlider');

				// check the type of argument passed
				if (typeof currentInstance[options] === 'function') {
					currentInstance[options].apply(currentInstance, args);
				} else if (typeof currentInstance.settings[options] !== 'undefined') {
					var obj = {};
					obj[options] = args[0];
					currentInstance._setProperties(obj);
				} else if (typeof options === 'object') {
					currentInstance._setProperties(options);
				} else {
					$.error(options + ' does not exist in accordionSlider.');
				}
			}
		});
	};
	
})(window, jQuery);

/*
	Autoplay module for Accordion Slider

	Adds autoplay functionality to the accordion
*/
;(function(window, $) {

	"use strict";
	
	var NS = $.AccordionSlider.namespace;

	var Autoplay = {

		autoplayIndex: -1,

		autoplayTimer: null,

		isTimerRunning: false,

		isTimerPaused: false,

		initAutoplay: function() {
			var that = this;

			if (this.settings.autoplay === true)
				this.startAutoplay();

			// start the autoplay timer each time the panel opens
			this.on('panelOpen.Autoplay.' + NS, function(event) {
				that.autoplayIndex = event.index;

				if (that.settings.autoplay === true) {
					// stop previous timers before starting a new one
					if (that.isTimerRunning === true)
						that.stopAutoplay();
					
					if (that.isTimerPaused === false)
						that.startAutoplay();
				}
			});

			// store the index of the previously opened panel
			this.on('panelsClose.Autoplay.' + NS, function(event) {
				if (event.previousIndex !== -1)
					that.autoplayIndex = event.previousIndex;
			});

			// store the index of the first panel from the new page
			this.on('pageScroll.Autoplay.' + NS, function(event) {
				that.autoplayIndex = that._getFirstPanelFromPage() - 1;
			});

			// on accordion hover stop the autoplay if autoplayOnHover is set to pause or stop
			this.on('mouseenter.Autoplay.' + NS, function(event) {
				if (that.settings.autoplay === true && that.isTimerRunning && (that.settings.autoplayOnHover === 'pause' || that.settings.autoplayOnHover === 'stop')) {
					that.stopAutoplay();
					that.isTimerPaused = true;
				}
			});

			// on accordion hover out restart the autoplay
			this.on('mouseleave.Autoplay.' + NS, function(event) {
				if (that.settings.autoplay === true && that.isTimerRunning === false && that.settings.autoplayOnHover !== 'stop') {
					that.startAutoplay();
					that.isTimerPaused = false;
				}
			});
		},

		startAutoplay: function() {
			var that = this;
			this.isTimerRunning = true;

			this.autoplayTimer = setTimeout(function() {
				// check if there is a stored index from which the autoplay needs to continue
				if (that.autoplayIndex !== -1)	{
					that.currentIndex = that.autoplayIndex;
					that.autoplayIndex = -1;
				}

				if (that.settings.autoplayDirection === 'normal') {
					that.nextPanel();
				} else if (that.settings.autoplayDirection === 'backwards') {
					that.previousPanel();
				}
			}, this.settings.autoplayDelay);
		},

		stopAutoplay: function() {
			this.isTimerRunning = false;

			clearTimeout(this.autoplayTimer);
		},

		destroyAutoplay: function() {
			clearTimeout(this.autoplayTimer);

			this.off('panelOpen.Autoplay.' + NS);
			this.off('pageScroll.Autoplay.' + NS);
			this.off('mouseenter.Autoplay.' + NS);
			this.off('mouseleave.Autoplay.' + NS);
		},

		autoplayDefaults: {
			autoplay: true,
			autoplayDelay: 5000,
			autoplayDirection: 'normal',
			autoplayOnHover: 'pause'
		}
	};

	$.AccordionSlider.addModule('Autoplay', Autoplay, 'accordion');
	
})(window, jQuery);

/*
	Keyboard module for Accordion Slider

	Adds keyboard navigation support to the accordion
*/
;(function(window, $) {

	"use strict";
	
	var NS = $.AccordionSlider.namespace;

	var Keyboard = {

		initKeyboard: function() {
			var that = this,
				hasFocus = false;

			if (this.settings.keyboard === false)
				return;
			
			this.$accordion.on('focus.Keyboard.' + NS, function() {
				hasFocus = true;
			});

			this.$accordion.on('blur.Keyboard.' + NS, function() {
				hasFocus = false;
			});

			$(document).on('keydown.Keyboard.' + this.uniqueId + '.' + NS, function(event) {
				if (that.settings.keyboardOnlyOnFocus === true && hasFocus === false)
					return;

				if (event.which === 37) {
					if (that.settings.keyboardTarget === 'page')
						that.previousPage();
					else
						that.previousPanel();
				} else if (event.which === 39) {
					if (that.settings.keyboardTarget === 'page')
						that.nextPage();
					else
						that.nextPanel();
				} else if (event.which === 13) {
					var link = that.$accordion.find('.as-panel').eq(that.currentIndex).children('a');

					if ( link.length !== 0 ) {
						link[0].click();
					}
				}
			});
		},

		destroyKeyboard: function() {
			this.$accordion.off('focus.Keyboard.' + NS);
			this.$accordion.off('blur.Keyboard.' + NS);
			$(document).off('keydown.Keyboard.' + this.uniqueId + '.' + NS);
		},

		keyboardDefaults: {
			keyboard: true,
			keyboardOnlyOnFocus: false,
			keyboardTarget: 'panel'
		}
	};

	$.AccordionSlider.addModule('Keyboard', Keyboard, 'accordion');
	
})(window, jQuery);

/*
	MouseWheel module for Accordion Slider

	Adds mouse wheel support for scrolling through pages or individual panels
*/
;(function(window, $) {

	"use strict";
	
	var NS = $.AccordionSlider.namespace;

	var MouseWheel = {

		mouseWheelEventType: '',

		allowMouseWheelScroll: true,

		initMouseWheel: function() {
			var that = this;

			if (this.settings.mouseWheel === false)
				return;

			// get the current mouse wheel event used in the browser
			if ('onwheel' in document)
				this.mouseWheelEventType = 'wheel';
			else if ('onmousewheel' in document)
				this.mouseWheelEventType = 'mousewheel';
			else if ('onDomMouseScroll' in document)
				this.mouseWheelEventType = 'DomMouseScroll';
			else if ('onMozMousePixelScroll' in document)
				this.mouseWheelEventType = 'MozMousePixelScroll';
			
			this.on(this.mouseWheelEventType + '.' + NS, function(event) {
				event.preventDefault();

				var eventObject = event.originalEvent,
					delta;

				// get the movement direction and speed indicated in the delta property
				if (typeof eventObject.detail !== 'undefined')
					delta = eventObject.detail;

				if (typeof eventObject.wheelDelta !== 'undefined')
					delta = eventObject.wheelDelta;

				if (typeof eventObject.deltaY !== 'undefined')
					delta = eventObject.deltaY * -1;

				if (that.allowMouseWheelScroll === true && Math.abs(delta) >= that.settings.mouseWheelSensitivity) {
					that.allowMouseWheelScroll = false;

					setTimeout(function() {
						that.allowMouseWheelScroll = true;
					}, 500);

					if (delta <= -that.settings.mouseWheelSensitivity)
						if (that.settings.mouseWheelTarget === 'page')
							that.nextPage();
						else
							that.nextPanel();
					else if (delta >= that.settings.mouseWheelSensitivity)
						if (that.settings.mouseWheelTarget === 'page')
							that.previousPage();
						else
							that.previousPanel();
				}
			});
		},

		destroyMouseWheel: function() {
			this.off(this.mouseWheelEventType + '.' + NS);
		},

		mouseWheelDefaults: {
			mouseWheel: true,
			mouseWheelSensitivity: 10,
			mouseWheelTarget: 'panel'
		}
	};

	$.AccordionSlider.addModule('MouseWheel', MouseWheel, 'accordion');
	
})(window, jQuery);

/*
	TouchSwipe module for Accordion Slider

	Adds touch swipe support for scrolling through pages
*/
;(function(window, $) {

	"use strict";
	
	var NS = $.AccordionSlider.namespace;

	var TouchSwipe = {

		touchStartPoint: {x: 0, y: 0},

		touchEndPoint: {x: 0, y: 0},

		touchDistance: {x: 0, y: 0},

		touchStartPosition: 0,

		isTouchMoving: false,

		touchSwipeEvents: { startEvent: '', moveEvent: '', endEvent: '' },

		// Indicates whether the previous 'start' event was a 'touchstart' or 'mousedown'
		previousStartEvent: '',

		initTouchSwipe: function() {
			var that = this;

			// check if touch swipe is enabled
			if (this.settings.touchSwipe === false)
				return;

			this.touchSwipeEvents.startEvent = 'touchstart' + '.' + NS + ' mousedown' + '.' + NS;
			this.touchSwipeEvents.moveEvent = 'touchmove' + '.' + NS + ' mousemove' + '.' + NS;
			this.touchSwipeEvents.endEvent = 'touchend' + '.' + this.uniqueId + '.' + NS + ' mouseup' + '.' + this.uniqueId + '.' + NS;

			this.$panelsContainer.on(this.touchSwipeEvents.startEvent, $.proxy(this._onTouchStart, this));
			this.$panelsContainer.on( 'dragstart.' + NS, function( event ) {
				event.preventDefault();
			});

			// prevent 'click' events unless there is intention for a 'click'
			this.$panelsContainer.find( 'a' ).on( 'click.' + NS, function( event ) {
				if ( that.$accordion.hasClass( 'as-swiping' ) ) {
					event.preventDefault();
				}
			});

			// prevent 'tap' events unless the panel is opened
			this.$panelsContainer.find( 'a' ).on( 'touchstart.' + NS, function( event ) {
				if ( $(this).parents('.as-panel').hasClass( 'as-opened' ) === false ) {
					event.preventDefault();
				}
			});

			this.on('update.TouchSwipe.' + NS, function() {
				// add or remove grabbing icon
				if (that.getTotalPages() > 1)
					that.$panelsContainer.addClass('as-grab');
				else
					that.$panelsContainer.removeClass('as-grab');
			});
		},

		_onTouchStart: function(event) {

			// return if a 'mousedown' event follows a 'touchstart' event
			if ( event.type === 'mousedown' && this.previousStartEvent === 'touchstart' ) {
				this.previousStartEvent = event.type;
				return;
			}

			// assign the new 'start' event
			this.previousStartEvent = event.type;

			var that = this,
				eventObject =  typeof event.originalEvent.touches !== 'undefined' ? event.originalEvent.touches[0] : event.originalEvent;

			// disable dragging if the element is set to allow selections
			if ($(event.target).closest('.as-selectable').length >= 1 || (typeof event.originalEvent.touches === 'undefined' && this.getTotalPages() === 1))
				return;

			// get the initial position of the mouse pointer and the initial position of the panels' container
			this.touchStartPoint.x = eventObject.pageX || eventObject.clientX;
			this.touchStartPoint.y = eventObject.pageY || eventObject.clientY;
			this.touchStartPosition = parseInt(this.$panelsContainer.css(this.positionProperty), 10);

			// clear the distance
			this.touchDistance.x = this.touchDistance.y = 0;

			// listen for 'move' and 'end' events
			this.$panelsContainer.on(this.touchSwipeEvents.moveEvent, $.proxy(this._onTouchMove, this));
			$(document).on(this.touchSwipeEvents.endEvent, $.proxy(this._onTouchEnd, this));

			// swap grabbing icons
			this.$panelsContainer.removeClass('as-grab').addClass('as-grabbing');
		},

		_onTouchMove: function(event) {
			var eventObject = typeof event.originalEvent.touches !== 'undefined' ? event.originalEvent.touches[0] : event.originalEvent;

			// indicate that the 'move' event is being fired
			this.isTouchMoving = true;

			if ( this.$accordion.hasClass('as-swiping') === false ) {
				this.$accordion.addClass('as-swiping');
			}

			// get the current position of the mouse pointer
			this.touchEndPoint.x = eventObject.pageX || eventObject.clientX;
			this.touchEndPoint.y = eventObject.pageY || eventObject.clientY;

			// calculate the distance of the movement on both axis
			this.touchDistance.x = this.touchEndPoint.x - this.touchStartPoint.x;
			this.touchDistance.y = this.touchEndPoint.y - this.touchStartPoint.y;
			
			var distance = this.settings.orientation === 'horizontal' ? this.touchDistance.x : this.touchDistance.y,
				oppositeDistance = this.settings.orientation === 'horizontal' ? this.touchDistance.y : this.touchDistance.x;

			if (Math.abs(distance) > Math.abs(oppositeDistance))
				event.preventDefault();
			else
				return;
			
			// get the current position of panels' container
			var currentPanelsPosition = parseInt(this.$panelsContainer.css(this.positionProperty), 10);
			
			// reduce the movement speed if the panels' container is outside its bounds
			if ((currentPanelsPosition >= 0 && this.currentPage === 0) || (currentPanelsPosition <= - this.totalPanelsSize + this.totalSize && this.currentPage === this.getTotalPages() - 1))
				distance = distance * 0.2;

			// move the panels' container
			this.$panelsContainer.css(this.positionProperty, this.touchStartPosition + distance);
		},

		_onTouchEnd: function(event) {
			var that = this;

			// remove the 'move' and 'end' listeners
			this.$panelsContainer.off(this.touchSwipeEvents.moveEvent);
			$(document).off(this.touchSwipeEvents.endEvent);

			// swap grabbing icons
			this.$panelsContainer.removeClass('as-grabbing').addClass('as-grab');

			// check if there is intention for a tap
			if (this.isTouchMoving === false || this.isTouchMoving === true && Math.abs(this.touchDistance.x) < 10 && Math.abs(this.touchDistance.y) < 10) {
				var index = $(event.target).parents('.as-panel').index();

				if (typeof event.originalEvent.touches !== 'undefined' && index !== this.currentIndex && index !== -1 && this.openPanelOn !== 'never') {
					this.openPanel(index);
				}
			}

			// remove the 'as-swiping' class with a delay, to allow
			// other event listeners (i.e. click) to check the existance
			// of the swipe event.
			if ( this.$accordion.hasClass('as-swiping') ) {
				setTimeout(function() {
					that.$accordion.removeClass('as-swiping');
				}, 100);
			}

			// return if there was no movement and re-enable click events on links
			if (this.isTouchMoving === false) {
				return;
			}

			this.isTouchMoving = false;

			var noScrollAnimObj = {};
			noScrollAnimObj[this.positionProperty] = this.touchStartPosition;

			// set the accordion's page based on the distance of the movement and the accordion's settings
			if (this.settings.orientation === 'horizontal') {
				if (this.touchDistance.x > this.settings.touchSwipeThreshold) {
					if (this.currentPage > 0) {
						this.previousPage();
					} else {
						this.$panelsContainer.stop().animate(noScrollAnimObj, 300);
					}
				} else if (- this.touchDistance.x > this.settings.touchSwipeThreshold) {
					if (this.currentPage < this.getTotalPages() - 1) {
						this.nextPage();
					} else {
						this.gotoPage(this.currentPage);
					}
				} else if (Math.abs(this.touchDistance.x) < this.settings.touchSwipeThreshold) {
					this.$panelsContainer.stop().animate(noScrollAnimObj, 300);
				}
			} else if (this.settings.orientation === 'vertical') {
				if (this.touchDistance.y > this.settings.touchSwipeThreshold) {
					if (this.currentPage > 0) {
						this.previousPage();
					} else {
						this.$panelsContainer.stop().animate(noScrollAnimObj, 300);
					}
				} else if (- this.touchDistance.y > this.settings.touchSwipeThreshold) {
					if (this.currentPage < this.getTotalPages() - 1) {
						this.nextPage();
					} else {
						this.$panelsContainer.animate(noScrollAnimObj, 300);
					}
				} else if (Math.abs(this.touchDistance.y) < this.settings.touchSwipeThreshold) {
					this.$panelsContainer.stop().animate(noScrollAnimObj, 300);
				}
			}
		},

		destroyTouchSwipe: function() {
			this.$panelsContainer.off( 'dragstart.' + NS );
			this.$panelsContainer.find( 'a' ).off( 'click.' + NS );
			this.$panelsContainer.find( 'a' ).off( 'touchstart.' + NS );

			this.$panelsContainer.off(this.touchSwipeEvents.startEvent);
			this.$panelsContainer.off(this.touchSwipeEvents.moveEvent);
			$(document).off(this.touchSwipeEvents.endEvent);
			
			this.off('update.TouchSwipe.' + NS);

			this.$panelsContainer.removeClass('as-grab');
		},

		touchSwipeDefaults: {
			touchSwipe: true,
			touchSwipeThreshold: 50
		}
	};

	$.AccordionSlider.addModule('TouchSwipe', TouchSwipe, 'accordion');
	
})(window, jQuery);