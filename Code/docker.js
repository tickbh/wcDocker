/*!
 * Web Cabin Docker - Docking Layout Interface.
 *
 * Dependencies:
 *  JQuery 1.11.1
 *  JQuery-contextMenu 1.6.6
 *  font-awesome 4.2.0
 *
 * Author: Jeff Houde (Lochemage@gmail.com)
 * Web: http://docker.webcabin.org/
 *
 * Licensed under
 *   MIT License http://www.opensource.org/licenses/mit-license
 *   GPL v3 http://opensource.org/licenses/GPL-3.0
 *
 */

// Provide backward compatibility for IE8 and other such older browsers.
if (!Function.prototype.bind) {
  Function.prototype.bind = function (oThis) {
    if (typeof this !== "function") {
      // closest thing possible to the ECMAScript 5
      // internal IsCallable function
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
    }

    var aArgs = Array.prototype.slice.call(arguments, 1), 
        fToBind = this, 
        fNOP = function () {},
        fBound = function () {
          return fToBind.apply(this instanceof fNOP && oThis
                 ? this
                 : oThis,
                 aArgs.concat(Array.prototype.slice.call(arguments)));
        };

    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();

    return fBound;
  };
}

if (!Array.prototype.indexOf)
{
  Array.prototype.indexOf = function(elt /*, from*/)
  {
    var len = this.length >>> 0;

    var from = Number(arguments[1]) || 0;
    from = (from < 0)
         ? Math.ceil(from)
         : Math.floor(from);
    if (from < 0)
      from += len;

    for (; from < len; from++)
    {
      if (from in this &&
          this[from] === elt)
        return from;
    }
    return -1;
  };
}

/**
 * @class
 * The main docker instance.  This manages all of the docking panels and user input.
 * There should only be one instance of this, although it is not enforced.<br>
 * See {@tutorial getting-started}
 * 
 * @constructor
 * @param {external:jQuery~selector|external:jQuery~Object|external:domNode} container - A container element to store the contents of wcDocker.
 * @param {wcDocker~Options} [options] - Options for constructing the instance.
 */
function wcDocker(container, options) {
  this.$container = $(container).addClass('wcDocker');
  this.$transition = $('<div class="wcDockerTransition"></div>');
  this.$container.append(this.$transition);

  this._events = {};

  this._root = null;
  this._frameList = [];
  this._floatingList = [];
  this._modalList = [];
  this._focusFrame = null;
  this._placeholderPanel = null;

  this._drawerList = [];
  this._splitterList = [];
  this._tabList = [];

  this._dockPanelTypeList = [];

  this._draggingSplitter = null;
  this._draggingFrame = null;
  this._draggingFrameSizer = null;
  this._draggingFrameTab = null;
  this._draggingCustomTabFrame = null;
  this._ghost = null;
  this._menuTimer = 0;
  this._mouseOrigin = {x: 0, y: 0};

  this._resizeData = {
    time: -1,
    timeout: false,
    delta: 150,
  };

  this._defaultOptions = {
    themePath: 'Themes',
    theme: 'default',
    allowContextMenu: true,
    hideOnResize: false
  };

  this._options = {};
  for (var prop in this._defaultOptions) {
    this._options[prop] = this._defaultOptions[prop];
  }
  for (var prop in options) {
    this._options[prop] = options[prop];
  }

  this.__init();
};

/**
 * Enumerated Docking positions.
 * @since 3.0.0
 * @enum {String}
 */
wcDocker.DOCK = {
  /** A floating panel that blocks input until closed */
  MODAL                 : 'modal',
  /** A floating panel */
  FLOAT                 : 'float',
  /** Docks to the top of a target or window */
  TOP                   : 'top',
  /** Docks to the left of a target or window */
  LEFT                  : 'left',
  /** Docks to the right of a target or window */
  RIGHT                 : 'right',
  /** Docks to the bottom of a target or window */
  BOTTOM                : 'bottom',
  /** Docks as another tabbed item along with the target */
  STACKED               : 'stacked'
};

/**
 * Enumerated Internal events
 * @since 3.0.0
 * @enum {String}
 */
wcDocker.EVENT = {
  /** When the panel is initialized */ 
  INIT                 : 'panelInit',
  /** When the panel is updated */
  UPDATED              : 'panelUpdated',
  /** When the panel has changed its visibility */
  VISIBILITY_CHANGED   : 'panelVisibilityChanged',
  /** When the user begins moving this panel from its current docked position */
  BEGIN_DOCK           : 'panelBeginDock',
  /** When the user finishes moving this panel */
  END_DOCK             : 'panelEndDock',
  /** When the user brings this panel into focus */
  GAIN_FOCUS           : 'panelGainFocus',
  /** When the user leaves focus on this panel */
  LOST_FOCUS           : 'panelLostFocus',
  /** When the panel is being closed */
  CLOSED               : 'panelClosed',
  /** When a custom button is clicked, See [wcPanel.addButton]{@link wcPanel#addButton} */
  BUTTON               : 'panelButton',
  /** When the panel has moved from floating to a docked position */
  ATTACHED             : 'panelAttached',
  /** When the panel has moved from a docked position to floating */
  DETACHED             : 'panelDetached',
  /** When the user has started moving the panel (top-left coordinates changed) */
  MOVE_STARTED         : 'panelMoveStarted',
  /** When the user has finished moving the panel */
  MOVE_ENDED           : 'panelMoveEnded',
  /** When the top-left coordinates of the panel has changed */
  MOVED                : 'panelMoved',
  /** When the user has started resizing the panel (width or height changed) */
  RESIZE_STARTED       : 'panelResizeStarted',
  /** When the user has finished resizing the panel */
  RESIZE_ENDED         : 'panelResizeEnded',
  /** When the panels width or height has changed */
  RESIZED              : 'panelResized',
  /** When the contents of the panel has been scrolled */
  SCROLLED             : 'panelScrolled',
  /** When the layout is being saved, See [wcDocker.save]{@link wcDocker#save} */
  SAVE_LAYOUT          : 'layoutSave',
  /** When the layout is being restored, See [wcDocker.restore]{@link wcDocker#restore} */
  RESTORE_LAYOUT       : 'layoutRestore',
  /** When the current tab on a custom tab widget associated with this panel has changed, See {@link wcTabFrame} */
  CUSTOM_TAB_CHANGED   : 'customTabChanged',
  /** When a tab has been closed on a custom tab widget associated with this panel, See {@link wcTabFrame} */
  CUSTOM_TAB_CLOSED    : 'customTabClosed'
};

/**
 * The name of the placeholder panel.
 * @constant {String}
 */
wcDocker.PANEL_PLACEHOLDER_NAME     = '__wcDockerPlaceholderPanel';

/**
 * Used for the splitter bar orientation.
 * @since 3.0.0
 * @enum {Boolean}
 */
wcDocker.ORIENTATION = {
  /** Top and Bottom panes */
  VERTICAL       : false,
  /** Left and Right panes */
  HORIZONTAL     : true
};

wcDocker.prototype = {
///////////////////////////////////////////////////////////////////////////////////////////////////////
// Public Functions
///////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Gets, or Sets the path where all theme files can be found.
   * "Themes" is the default folder path.
   *
   * @param {String} path - If supplied, will set the path where all themes can be found.
   *
   * @returns {String} - The currently assigned path.
   */
  themePath: function(path) {
    if (path !== undefined) {
      this._options.themePath = path;
    }
    return this._options.themePath;
  },

  /**
   * Gets, or Sets the current theme used by docker.
   *
   * @param {String} themeName - If supplied, will activate a theme with the given name.
   *
   * @returns {String} - The currently active theme.
   */
  theme: function(themeName) {
    if (themeName !== undefined) {
      $('#wcTheme').remove();
      // The default theme requires no additional theme css file.
      var cacheBreak = (new Date()).getTime();
      var ext = themeName.indexOf('.css');
      if (ext > -1) {
        themeName = themeName.substring(0, ext);
      }
      var $link = $('<link id="wcTheme" rel="stylesheet" type="text/css" href="' + this._options.themePath + '/' + themeName + '.css?v=' + cacheBreak + '"/>');
      this._options.theme = themeName;

      var self = this;
      $link[0].onload = function() {
        self.__update();

        // Special update to fix the size of collapsed drawers
        // in case the theme has changed it.
        for (var i = 0; i < self._drawerList.length; ++i) {
          if (!self._drawerList[i].isExpanded()) {
            self._drawerList[i]._parent.__update(false);
          }
        }
      }

      $('head').append($link);
    }

    return this._options.theme;
  },

  /**
   * Registers a new docking panel type to be used later.
   * @since 3.0.0
   *
   * @param {String} name                       - The name identifier for the new panel type.
   * @param {wcDocker~registerOptions} options  - An options object for describing the panel type.
   * @param {Boolean} [isPrivate]               - <b>DEPRECATED:</b> Use [options]{@link wcDocker~registerOptions} instead.
   *
   * @returns {Boolean} - Success or failure. Failure usually indicates the type name already exists.
   */
  registerPanelType: function(name, optionsOrCreateFunc, isPrivate) {

    var options = optionsOrCreateFunc;
    if (typeof options === 'function') {
      options = {
        onCreate: optionsOrCreateFunc,
      };
      console.log("Warning! Passing in the creation function directly to wcDocker.registerPanelType parameter 2 is now deprecated and will be removed in the next version!  Please use the preferred options object instead.");
    }

    if (typeof isPrivate != 'undefined') {
      options.isPrivate = isPrivate;
      console.log("Warning! Passing in the isPrivate flag to wcDocker.registerPanelType parameter 3 is now deprecated and will be removed in the next version!  Please use the preferred options object instead.");
    }

    if ($.isEmptyObject(options)) {
      options = null;
    }

    for (var i = 0; i < this._dockPanelTypeList.length; ++i) {
      if (this._dockPanelTypeList[i].name === name) {
        return false;
      }
    }

    this._dockPanelTypeList.push({
      name: name,
      options: options,
    });

    var $menu = $('menu').find('menu');
    $menu.append($('<menuitem label="' + name + '">'));
    return true;
  },

  /**
   * Retrieves a list of all currently registered panel types.
   *
   * @param {Boolean} includePrivate - If true, panels registered as private will also be included with this list.
   *
   * @returns {String[]} - A list of panel type names.
   */
  panelTypes: function(includePrivate) {
    var result = [];
    for (var i = 0; i < this._dockPanelTypeList.length; ++i) {
      if (includePrivate || !this._dockPanelTypeList[i].options.isPrivate) {
        result.push(this._dockPanelTypeList[i].name);
      }
    }
    return result;
  },

  /**
   * Retrieves the options data associated with a given panel type when it was registered.
   *
   * @param {String} typeName - The name identifier of the panel.
   *
   * @returns {wcDocker~registerOptions} - Registered options of the panel type, or false if the panel was not found.
   */
  panelTypeInfo: function(typeName) {
    for (var i = 0; i < this._dockPanelTypeList.length; ++i) {
      if (this._dockPanelTypeList[i].name == typeName) {
        return this._dockPanelTypeList[i].options;
      }
    }
    return false;
  },

  /**
   * Add a new docked panel to the docker instance.
   *
   * @param {String} typeName         - The name identifier of the panel to create.
   * @param {wcDocker.DOCK} location  - The docking location to place this panel.
   * @param {wcPanel} [targetPanel]   - A target panel to dock relative to.
   * @param {wcDocker~Rect} [rect]    - A rectangle that defines the desired bounds of the panel. Note: Actual placement and size will vary depending on docked position.
   *
   * @returns {wcPanel|Boolean} - The newly created panel object, or false if no panel was created.
   */
  addPanel: function(typeName, location, targetPanel, rect) {
    for (var i = 0; i < this._dockPanelTypeList.length; ++i) {
      if (this._dockPanelTypeList[i].name === typeName) {
        var panelType = this._dockPanelTypeList[i];
        var panel = new wcPanel(typeName, panelType.options);
        panel._parent = this;
        panel.__container(this.$transition);
        var options = (panelType.options && panelType.options.options) || {};
        panel._panelObject = new panelType.options.onCreate(panel, options);

        if (location === wcDocker.DOCK.STACKED) {
          this.__addPanelGrouped(panel, targetPanel);
        } else {
          this.__addPanelAlone(panel, location, targetPanel, rect);
        }

        if (this._placeholderPanel && panel.moveable() &&
            location !== wcDocker.DOCK.FLOAT &&
            location !== wcDocker.DOCK.MODAL) {
          if (this.removePanel(this._placeholderPanel)) {
            this._placeholderPanel = null;
          }
        }

        this.__update();
        return panel;
      }
    }
    return false;
  },

  /**
   * Removes a docked panel from the window.
   *
   * @param {wcPanel} panel - The panel to remove.
   *
   * @returns {Boolean} - Success or failure.
   */
  removePanel: function(panel) {
    if (!panel) {
      return false;
    }

    // Do not remove if this is the last moveable panel.
    var lastPanel = this.__isLastPanel(panel);

    var parentFrame = panel._parent;
    if (parentFrame instanceof wcFrame) {
      panel.__trigger(wcDocker.EVENT.CLOSED);

      // If no more panels remain in this frame, remove the frame.
      if (!parentFrame.removePanel(panel)) {
        // If this is the last frame, create a dummy panel to take up
        // the space until another one is created.
        if (lastPanel) {
          this.__addPlaceholder(parentFrame);
          return true;
        }

        var index = this._floatingList.indexOf(parentFrame);
        if (index !== -1) {
          this._floatingList.splice(index, 1);
        }
        index = this._frameList.indexOf(parentFrame);
        if (index !== -1) {
          this._frameList.splice(index, 1);
        }
        index = this._modalList.indexOf(parentFrame);
        if (index !== -1) {
          this._modalList.splice(index, 1);
        }

        if (this._modalList.length) {
          this.__focus(this._modalList[this._modalList.length-1]);
        } else if (this._floatingList.length) {
          this.__focus(this._floatingList[this._floatingList.length-1]);
        }

        var parentSplitter = parentFrame._parent;
        if (parentSplitter instanceof wcSplitter) {
          parentSplitter.__removeChild(parentFrame);

          var other;
          if (parentSplitter.pane(0)) {
            other = parentSplitter.pane(0);
            parentSplitter._pane[0] = null;
          } else {
            other = parentSplitter.pane(1);
            parentSplitter._pane[1] = null;
          }

          // Keep the panel in a hidden transition container so as to not
          // destroy any event handlers that may be on it.
          other.__container(this.$transition);
          other._parent = null;

          index = this._splitterList.indexOf(parentSplitter);
          if (index !== -1) {
            this._splitterList.splice(index, 1);
          }

          var parent = parentSplitter._parent;
          parentContainer = parentSplitter.__container();
          parentSplitter.__destroy();

          if (parent instanceof wcSplitter) {
            parent.__removeChild(parentSplitter);
            if (!parent.pane(0)) {
              parent.pane(0, other);
            } else {
              parent.pane(1, other);
            }
          } else if (parent instanceof wcDrawer) {
            parent._root = other;
            other._parent = parent;
            other.__container(parentContainer);
          } else if (parent === this) {
            this._root = other;
            other._parent = this;
            other.__container(parentContainer);
          }
          this.__update();
        } else if (parentSplitter instanceof wcDrawer) {
          parentSplitter._root = null;
        } else if (parentFrame === this._root) {
          this._root = null;
        }

        if (this._focusFrame === parentFrame) {
          this._focusFrame = null;
        }
        parentFrame.__destroy();
      }
      panel.__destroy();
      return true;
    }
    return false;
  },

  /**
   * Moves a docking panel from its current location to another.
   *
   * @param {wcPanel} panel           - The panel to move.
   * @param {wcDocker.DOCK} location  - The new docking location of the panel.
   * @param {wcPanel} [targetPanel]   - A target panel to dock relative to.
   * @param {wcDocker~Rect} [rect]    - A rectangle that defines the desired bounds of the panel. Note: Actual placement and size will vary depending on docked position.
   *
   * @returns {wcPanel|Boolean} - The panel that was created, or false on failure.
   */
  movePanel: function(panel, location, targetPanel, rect) {
    var lastPanel = this.__isLastPanel(panel);

    var $elem = panel.$container;
    if (panel._parent instanceof wcFrame) {
      $elem = panel._parent.$frame;
    }
    var offset = $elem.offset();
    var width  = $elem.width();
    var height = $elem.height();

    var parentFrame = panel._parent;
    var floating = false;
    if (parentFrame instanceof wcFrame) {
      floating = parentFrame._isFloating;
      // Remove the panel from the frame.
      for (var i = 0; i < parentFrame._panelList.length; ++i) {
        if (parentFrame._panelList[i] === panel) {
          if (parentFrame._curTab >= i) {
            parentFrame._curTab--;
          }

          // Keep the panel in a hidden transition container so as to not
          // destroy any event handlers that may be on it.
          panel.__container(this.$transition);
          panel._parent = null;

          parentFrame._panelList.splice(i, 1);
          break;
        }
      }

      if (parentFrame._curTab === -1 && parentFrame._panelList.length) {
        parentFrame._curTab = 0;
      }

      parentFrame.__updateTabs();
      
      // If no more panels remain in this frame, remove the frame.
      if (parentFrame._panelList.length === 0) {
        // If this is the last frame, create a dummy panel to take up
        // the space until another one is created.
        if (lastPanel) {
          this.__addPlaceholder(parentFrame);
        } else {
          var index = this._floatingList.indexOf(parentFrame);
          if (index !== -1) {
            this._floatingList.splice(index, 1);
          }
          index = this._frameList.indexOf(parentFrame);
          if (index !== -1) {
            this._frameList.splice(index, 1);
          }

          var parentSplitter = parentFrame._parent;
          if (parentSplitter instanceof wcSplitter) {
            parentSplitter.__removeChild(parentFrame);

            var other;
            if (parentSplitter.pane(0)) {
              other = parentSplitter.pane(0);
              parentSplitter._pane[0] = null;
            } else {
              other = parentSplitter.pane(1);
              parentSplitter._pane[1] = null;
            }

            // Keep the item in a hidden transition container so as to not
            // destroy any event handlers that may be on it.
            other.__container(this.$transition);
            other._parent = null;

            index = this._splitterList.indexOf(parentSplitter);
            if (index !== -1) {
              this._splitterList.splice(index, 1);
            }

            var parent = parentSplitter._parent;
            parentContainer = parentSplitter.__container();
            parentSplitter.__destroy();

            if (parent instanceof wcSplitter) {
              parent.__removeChild(parentSplitter);
              if (!parent.pane(0)) {
                parent.pane(0, other);
              } else {
                parent.pane(1, other);
              }
            } else if (parent instanceof wcDrawer) {
              parent._root = other;
              other._parent = parent;
              other.__container(parentContainer);
            } else if (parent === this) {
              this._root = other;
              other._parent = this;
              other.__container(parentContainer);
            }
            this.__update();
          } else if (parentSplitter instanceof wcDrawer) {
            parentSplitter._root = null;
          }

          if (this._focusFrame === parentFrame) {
            this._focusFrame = null;
          }

          parentFrame.__destroy();
        }
      }
    }

    panel.initSize(width, height);
    if (location === wcDocker.DOCK.STACKED) {
      this.__addPanelGrouped(panel, targetPanel);
    } else {
      this.__addPanelAlone(panel, location, targetPanel, rect);
    }

    if (targetPanel == this._placeholderPanel) {
      this.removePanel(this._placeholderPanel);
      this._placeholderPanel = null;
    }

    var frame = panel._parent;
    if (frame instanceof wcFrame) {
      if (frame._panelList.length === 1) {
        frame.pos(offset.left + width/2 + 20, offset.top + height/2 + 20, true);
      }
    }

    this.__update();

    if (frame instanceof wcFrame) {
      if (floating !== frame._isFloating) {
        if (frame._isFloating) {
          panel.__trigger(wcDocker.EVENT.DETACHED);
        } else {
          panel.__trigger(wcDocker.EVENT.ATTACHED);
        }
      }
    }

    panel.__trigger(wcDocker.EVENT.MOVED);
    return panel;
  },

  /**
   * Finds all instances of a given panel type.
   *
   * @param {String} typeName - The name identifier for the panel.
   *
   * @returns {wcPanel[]} - A list of all panels found of the given type.
   */
  findPanels: function(typeName) {
    var result = [];
    for (var i = 0; i < this._frameList.length; ++i) {
      var frame = this._frameList[i];
      for (var a = 0; a < frame._panelList.length; ++a) {
        var panel = frame._panelList[a];
        if (!typeName || panel._type === typeName) {
          result.push(panel);
        }
      }
    }

    return result;
  },

  /**
   * Adds a collapsible drawer container to a given position of the docking window.
   * Drawer containers will appear on the outside of all currently docked panels.
   * This should be used after you have finished laying out the main panels
   * but before you dock any static panels at the top such as file or tool bar.
   *
   * @param {wcDocker~DOCK} location - The docking location to place this drawer.
   *
   * @returns {wcDrawer} The drawer object that was created.
   */
  addDrawer: function(location) {
    var drawer = new wcDrawer(this.$transition, this, location);
    this._drawerList.push(drawer);

    if (!this._root) {
      this._root = drawer;
      drawer.__container(this.$container);
    } else {
      var splitter = new wcSplitter(this.$container, this, location !== wcDocker.DOCK.BOTTOM && location !== wcDocker.DOCK.TOP);
      if (splitter) {
        drawer._parent = splitter;
        splitter.$bar.addClass('wcDrawerSplitterBar');
        splitter.scrollable(0, false, false);
        splitter.scrollable(1, false, false);
        var size = {
          x: this.$container.width(),
          y: this.$container.height(),
        };

        if (location === wcDocker.DOCK.LEFT || location === wcDocker.DOCK.TOP) {
          splitter.pane(0, drawer);
          splitter.pane(1, this._root);
        } else {
          splitter.pane(0, this._root);
          splitter.pane(1, drawer);
        }

        switch (location) {
          case wcDocker.DOCK.LEFT:
            splitter.pos(size.x/4 / size.x);
            break;
          case wcDocker.DOCK.RIGHT:
            splitter.pos(1.0 - (size.x/4 / size.x));
            break;
          case wcDocker.DOCK.TOP:
            splitter.pos(size.y/4 / size.y);
            break;
          case wcDocker.DOCK.BOTTOM:
            splitter.pos(1.0 - (size.y/4 / size.y));
            break;
        }

        this._root = splitter;
      }
    }

    return drawer;
  },

  /**
   * Retrieves the list of all drawer containers.
   *
   * @returns {wcDrawer[]} - The list of currently active drawer containers.
   */
  drawers: function() {
    return this._drawerList;
  },

  /**
   * Registers a global [event]{@link wcDocker.EVENT}.
   *
   * @param {wcDocker.EVENT} eventType        - The event type, can be a custom event string or a [predefined event]{@link wcDocker.EVENT}.
   * @param {wcDocker~event:onEvent} handler  - A handler function to be called for the event.
   *
   * @returns {Boolean} Success or failure that the event has been registered.
   */
  on: function(eventType, handler) {
    if (!eventType) {
      return false;
    }

    if (!this._events[eventType]) {
      this._events[eventType] = [];
    }

    if (this._events[eventType].indexOf(handler) !== -1) {
      return false;
    }

    this._events[eventType].push(handler);
    return true;
  },

  /**
   * Unregisters a global [event]{@link wcDocker.EVENT}.
   *
   * @param {wcDocker.EVENT} eventType          - The event type, can be a custom event string or a [predefined event]{@link wcDocker.EVENT}.
   * @param {wcDocker~event:onEvent} [handler]  - The handler function registered with the event. If omitted, all events registered to the event type are unregistered.
   */
  off: function(eventType, handler) {
    if (typeof eventType === 'undefined') {
      this._events = {};
      return;
    } else {
      if (this._events[eventType]) {
        if (typeof handler === 'undefined') {
          this._events[eventType] = [];
        } else {
          for (var i = 0; i < this._events[eventType].length; ++i) {
            if (this._events[eventType][i] === handler) {
              this._events[eventType].splice(i, 1);
              break;
            }
          }
        }
      }
    }
  },

  /**
   * Trigger an [event]{@link wcDocker.EVENT} on all panels.
   * @fires wcDocker~event:onEvent
   *
   * @param {wcDocker.EVENT} eventType  - The event type, can be a custom event string or a [predefined event]{@link wcDocker.EVENT}.
   * @param {Object} [data]             - A custom data object to be passed along with the event.
   */
  trigger: function(eventName, data) {
    if (!eventName) {
      return false;
    }

    for (var i = 0; i < this._frameList.length; ++i) {
      var frame = this._frameList[i];
      for (var a = 0; a < frame._panelList.length; ++a) {
        var panel = frame._panelList[a];
        panel.__trigger(eventName, data);
      }
    }

    this.__trigger(eventName, data);
  },

  /**
   * Assigns a basic context menu to a selector element.  The context
   * Menu is a simple list of options, no nesting or special options.
   *
   * If you wish to use a more complex context menu, you can use
   * [jQuery.contextMenu]{@link http://medialize.github.io/jQuery-contextMenu/docs.html} directly.
   *
   * @param {external:jQuery~selector} selector                               - A selector string that designates the elements who use this menu.
   * @param {external:jQuery#contextMenu~item[]|Function} itemListOrBuildFunc - An array with each context menu item in it, or a function to call that returns one.
   * @param {Boolean} includeDefault                                          - If true, all default menu options will be included.
   */
  basicMenu: function(selector, itemListOrBuildFunc, includeDefault) {
    var self = this;
    $.contextMenu({
      selector: selector,
      build: function($trigger, event) {
        var myFrame, myDrawer;
        for (var i = 0; i < self._frameList.length; ++i) {
          var $frame = $trigger.hasClass('wcFrame') && $trigger || $trigger.parents('.wcFrame');
          if (self._frameList[i].$frame[0] === $frame[0]) {
            myFrame = self._frameList[i];
            break;
          }
        }

        if (!myFrame) {
          for (var i = 0; i < self._drawerList.length; ++i) {
            var $drawer = $trigger.hasClass('wcDrawer') && $trigger || $trigger.parents('.wcDrawer');
            if (self._drawerList[i].$drawer[0] === $drawer[0]) {
              myDrawer = self._drawerList[i];
              break;
            }
          }
        }

        var mouse = {
          x: event.clientX,
          y: event.clientY,
        };
        var isTitle = false;
        if ($(event.target).hasClass('wcTabScroller')) {
          isTitle = true;
        }

        var windowTypes = {};
        for (var i = 0; i < self._dockPanelTypeList.length; ++i) {
          var type = self._dockPanelTypeList[i];
          if (!type.options.isPrivate) {
            if (type.options.limit > 0) {
              if (self.findPanels(type.name).length >= type.options.limit) {
                continue;
              }
            }
            var icon = null;
            var faicon = null;
            var label = type.name;
            if (type.options) {
              if (type.options.faicon) {
                faicon = type.options.faicon;
              }
              if (type.options.icon) {
                icon = type.options.icon;
              }
              if (type.options.title) {
                label = type.options.title;
              }
            }
            windowTypes[type.name] = {
              name: label,
              icon: icon,
              faicon: faicon,
              className: 'wcMenuCreatePanel',
            };
          }
        }

        var separatorIndex = 0;
        var finalItems = {};
        var itemList = itemListOrBuildFunc;
        if (typeof itemListOrBuildFunc === 'function') {
          itemList = itemListOrBuildFunc($trigger, event);
        }

        for (var i = 0; i < itemList.length; ++i) {
          if ($.isEmptyObject(itemList[i])) {
            finalItems['sep' + separatorIndex++] = "---------";
            continue;
          }

          var callback = itemList[i].callback;
          if (callback) {
            (function(listItem, callback) {
              listItem.callback = function(key, opts) {
                var panel = null;
                var $frame = opts.$trigger.parents('.wcFrame').first();
                if ($frame.length) {
                  for (var a = 0; a < self._frameList.length; ++a) {
                    if ($frame[0] === self._frameList[a].$frame[0]) {
                      panel = self._frameList[a].panel();
                    }
                  }
                }

                callback(key, opts, panel);
              };
            })(itemList[i], callback);
          }
          finalItems[itemList[i].name] = itemList[i];
        }

        var items = finalItems;

        if (includeDefault) {
          if (!$.isEmptyObject(finalItems)) {
            items['sep' + separatorIndex++] = "---------";
          }

          if (isTitle) {
            items['Close Panel'] = {
              name: 'Close Tab',
              faicon: 'close',
              disabled: !myFrame.panel().closeable(),
            };
            if (!myFrame._isFloating) {
              items['Detach Panel'] = {
                name: 'Detach Tab',
                faicon: 'level-down',
                disabled: !myFrame.panel().moveable() || myFrame.panel()._isPlaceholder,
              };
            }

            items['sep' + separatorIndex++] = "---------";
    
            items.fold1 = {
              name: 'Add Tab',
              faicon: 'columns',
              items: windowTypes,
              disabled: !(myFrame.panel()._titleVisible && (!myFrame._isFloating || self._modalList.indexOf(myFrame) === -1)),
              className: 'wcMenuCreatePanel',
            };
            items['sep' + separatorIndex++] = "---------";

            items['Flash Panel'] = {
              name: 'Flash Panel',
              faicon: 'lightbulb-o',
            };
          } else {
            if (myFrame) {
              items['Close Panel'] = {
                name: 'Close Panel',
                faicon: 'close',
                disabled: !myFrame.panel().closeable(),
              };
              if (!myFrame._isFloating) {
                items['Detach Panel'] = {
                  name: 'Detach Panel',
                  faicon: 'level-down',
                  disabled: !myFrame.panel().moveable() || myFrame.panel()._isPlaceholder,
                };
              }

              items['sep' + separatorIndex++] = "---------";
            }

            items.fold1 = {
              name: 'Insert Panel',
              faicon: 'columns',
              items: windowTypes,
              disabled: !(!myFrame || (!myFrame._isFloating && myFrame.panel().moveable())),
              className: 'wcMenuCreatePanel',
            };
          }

          if (myFrame && !myFrame._isFloating && myFrame.panel().moveable()) {
            var rect = myFrame.__rect();
            self._ghost = new wcGhost(rect, mouse, self);
            myFrame.__checkAnchorDrop(mouse, false, self._ghost, true);
            self._ghost.$ghost.hide();
          } else if (myDrawer) {
            var rect = myDrawer.__rect();
            self._ghost = new wcGhost(rect, mouse, self);
            myDrawer.__checkAnchorDrop(mouse, false, self._ghost, true);
            self._ghost.$ghost.hide();
          }
        }

        return {
          callback: function(key, options) {
            if (key === 'Close Panel') {
              setTimeout(function() {
                myFrame.panel().close();
              }, 10);
            } else if (key === 'Detach Panel') {
              self.movePanel(myFrame.panel(), wcDocker.DOCK.FLOAT, false);
            } else if (key === 'Flash Panel') {
              self.__focus(myFrame, true);
            } else {
              if (self._ghost && (myFrame || myDrawer)) {
                var anchor = self._ghost.anchor();
                var newPanel = self.addPanel(key, anchor.loc, myFrame? myFrame.panel(): myDrawer, self._ghost.rect());
                newPanel.focus();
              }
            }
          },
          events: {
            show: function(opt) {
              (function(items){

                // Whenever them menu is shown, we update and add the faicons.
                // Grab all those menu items, and propogate a list with them.
                var menuItems = {};
                var options = opt.$menu.find('.context-menu-item');
                for (var i = 0; i < options.length; ++i) {
                  var $option = $(options[i]);
                  var $span = $option.find('span');
                  if ($span.length) {
                    menuItems[$span[0].innerHTML] = $option;
                  }
                }

                // function calls itself so that we get nice icons inside of menus as well.
                (function recursiveIconAdd(items) {
                  for(var it in items) {
                    var item = items[it];
                    var $menu = menuItems[item.name];

                    if ($menu) {
                      var $icon = $('<div class="wcMenuIcon">');
                      $menu.prepend($icon);

                      if (item.icon) {
                        $icon.addClass(item.icon);
                      }

                      if (item.faicon) {
                        $icon.addClass('fa fa-menu fa-' + item.faicon + ' fa-lg fa-fw');
                      }

                      // Custom submenu arrow.
                      if ($menu.hasClass('context-menu-submenu')) {
                        var $expander = $('<div class="wcMenuSubMenu fa fa-caret-right fa-lg">');
                        $menu.append($expander);
                      }
                    }

                    // Iterate through sub-menus.
                    if (item.items) {
                      recursiveIconAdd(item.items);
                    }
                  }
                })(items);

              })(items);
            },
            hide: function(opt) {
              if (self._ghost) {
                self._ghost.__destroy();
                self._ghost = false;
              }
            },
          },
          animation: {duration: 250, show: 'fadeIn', hide: 'fadeOut'},
          reposition: false,
          autoHide: true,
          zIndex: 200,
          items: items,
        };
      },
    });
  },

  /**
   * Bypasses the next context menu event.
   * Use this during a mouse up event in which you do not want the
   * context menu to appear when it normally would have.
   */
  bypassMenu: function() {
    if (this._menuTimer) {
      clearTimeout(this._menuTimer);
    }

    for (var i in $.contextMenu.menus) {
      var menuSelector = $.contextMenu.menus[i].selector;
      $(menuSelector).contextMenu(false);
    }

    var self = this;
    this._menuTimer = setTimeout(function() {
      for (var i in $.contextMenu.menus) {
        var menuSelector = $.contextMenu.menus[i].selector;
        $(menuSelector).contextMenu(true);
      }
      self._menuTimer = null;
    }, 0);
  },

  /**
   * Saves the current panel configuration into a serialized
   * string that can be used later to restore it.
   *
   * @returns {String} - A serialized string that describes the current panel configuration.
   */
  save: function() {
    var data = {};

    data.floating = [];
    for (var i = 0; i < this._floatingList.length; ++i) {
      data.floating.push(this._floatingList[i].__save());
    }

    data.root = this._root.__save();
    
    return JSON.stringify(data, function(key, value) {
      if (value == Infinity) {
        return "Infinity";
      }
      return value;
    });
  },

  /**
   * Restores a previously saved configuration.
   *
   * @param {String} dataString - A previously saved serialized string, See [wcDocker.save]{@link wcDocker#save}.
   */
  restore: function(dataString) {
    var data = JSON.parse(dataString, function(key, value) {
      if (value === 'Infinity') {
        return Infinity;
      }
      return value;
    });

    this.clear();

    this._root = this.__create(data.root, this, this.$container);
    this._root.__restore(data.root, this);

    for (var i = 0; i < data.floating.length; ++i) {
      var panel = this.__create(data.floating[i], this, this.$container);
      panel.__restore(data.floating[i], this);
    }

    this.__update(false);
  },

  /**
   * Clears all contents from the docker instance.
   */
  clear: function() {
    this._root = null;

    for (var i = 0; i < this._splitterList.length; ++i) {
      this._splitterList[i].__destroy();
    }

    for (var i = 0; i < this._frameList.length; ++i) {
      this._frameList[i].__destroy();
    }

    for (var i = 0; i < this._drawerList.length; ++i) {
      this._drawerList[i].__destroy();
    }

    while (this._drawerList.length) this._drawerList.pop();
    while (this._frameList.length) this._frameList.pop();
    while (this._floatingList.length) this._floatingList.pop();
    while (this._splitterList.length) this._splitterList.pop();
  },


///////////////////////////////////////////////////////////////////////////////////////////////////////
// Private Functions
///////////////////////////////////////////////////////////////////////////////////////////////////////

  __init: function() {
    this._root = null;
    this.__addPlaceholder();
    
    // Setup our context menus.
    if (this._options.allowContextMenu) {
      this.basicMenu('.wcFrame, .wcDrawer', [], true);
    }

    this.theme(this._options.theme);

    var self = this;
    var contextTimer;
    $(window).resize(self.__resize.bind(self));

    $('body').on('contextmenu', 'a, img', function() {
      if (contextTimer) {
        clearTimeout(contextTimer);
      }

      $(".wcFrame").contextMenu(false);
      contextTimer = setTimeout(function() {
        $(".wcFrame").contextMenu(true);
        contextTimer = null;
      }, 100);
      return true;
    });

    $('body').on('contextmenu', '.wcSplitterBar', function() {
      return false;
    });
    
    // Hovering over a panel creation context menu.
    $('body').on('mouseenter', '.wcMenuCreatePanel', function() {
      if (self._ghost) {
        self._ghost.$ghost.stop().fadeIn(200);
      }
    });

    $('body').on('mouseleave', '.wcMenuCreatePanel', function() {
      if (self._ghost) {
        self._ghost.$ghost.stop().fadeOut(200);
      }
    });

    // A catch all on mouse down to record the mouse origin position.
    $('body').on('mousedown', function(event) {
      self._mouseOrigin.x = event.clientX;
      self._mouseOrigin.y = event.clientY;
    });

    $('body').on('mousedown', '.wcModalBlocker', function(event) {
      // for (var i = 0; i < self._modalList.length; ++i) {
      //   self._modalList[i].__focus(true);
      // }
      if (self._modalList.length) {
        self._modalList[self._modalList.length-1].__focus(true);
      }
    });

    // On some browsers, clicking and dragging a tab will drag it's graphic around.
    // Here I am disabling this as it interferes with my own drag-drop.
    $('body').on('mousedown', '.wcPanelTab', function(event) {
      event.preventDefault();
      event.returnValue = false;
    });

    $('body').on('selectstart', '.wcFrameTitle, .wcPanelTab, .wcFrameButton', function(event) {
      event.preventDefault();
    });

    // Close button on frames should destroy those panels.
    $('body').on('mousedown', '.wcFrame > .wcFrameButtonBar > .wcFrameButton', function() {
      self.$container.addClass('wcDisableSelection');
    });

    // Clicking on a panel frame button.
    $('body').on('click', '.wcFrame > .wcFrameButtonBar > .wcFrameButton', function() {
      self.$container.removeClass('wcDisableSelection');
      for (var i = 0; i < self._frameList.length; ++i) {
        var frame = self._frameList[i];
        if (frame.$close[0] === this) {
          var panel = frame.panel();
          self.removePanel(panel);
          self.__update();
          return;
        }
        if (frame.$tabLeft[0] === this) {
          frame._tabScrollPos-=frame.$title.width()/2;
          if (frame._tabScrollPos < 0) {
            frame._tabScrollPos = 0;
          }
          frame.__updateTabs();
          return;
        }
        if (frame.$tabRight[0] === this) {
          frame._tabScrollPos+=frame.$title.width()/2;
          frame.__updateTabs();
          return;
        }

        for (var a = 0; a < frame._buttonList.length; ++a) {
          if (frame._buttonList[a][0] === this) {
            var $button = frame._buttonList[a];
            var result = {
              name: $button.data('name'),
              isToggled: false,
            }

            if ($button.hasClass('wcFrameButtonToggler')) {
              $button.toggleClass('wcFrameButtonToggled');
              if ($button.hasClass('wcFrameButtonToggled')) {
                result.isToggled = true;
              }
            }

            var panel = frame.panel();
            panel.buttonState(result.name, result.isToggled);
            panel.__trigger(wcDocker.EVENT.BUTTON, result);
            return;
          }
        }
      }
    });

    // Clicking on a custom tab button.
    $('body').on('click', '.wcCustomTab > .wcFrameButton', function() {
      self.$container.removeClass('wcDisableSelection');
      for (var i = 0; i < self._tabList.length; ++i) {
        var customTab = self._tabList[i];
        if (customTab.$close[0] === this) {
          var tabIndex = customTab.tab();
          customTab.removeTab(tabIndex);
          return;
        }

        if (customTab.$tabLeft[0] === this) {
          customTab._tabScrollPos-=customTab.$title.width()/2;
          if (customTab._tabScrollPos < 0) {
            customTab._tabScrollPos = 0;
          }
          customTab.__updateTabs();
          return;
        }
        if (customTab.$tabRight[0] === this) {
          customTab._tabScrollPos+=customTab.$title.width()/2;
          customTab.__updateTabs();
          return;
        }
      }
    });

    // Clicking on the splitter used for a drawer panel will toggle its expanded state.
    $('body').on('click', '.wcDrawerOuterBar', function() {
      self.$container.removeClass('wcDisableSelection');
      // if (Math.max(Math.abs(self._mouseOrigin.x - event.clientX), Math.abs(self._mouseOrigin.y - event.clientY)) < 1) {
        for (var i = 0; i < self._drawerList.length; ++i) {
          var drawer = self._drawerList[i];
          if (drawer.$bar[0] === this) {
            drawer.toggle();
            return;
          }
        }
      // }
    });

    // Middle mouse button on a panel tab to close it.
    $('body').on('mouseup', '.wcPanelTab', function(event) {
      if (event.which !== 2) {
        return;
      }

      var index = parseInt($(this).attr('id'));

      for (var i = 0; i < self._frameList.length; ++i) {
        var frame = self._frameList[i];
        if (frame.$title[0] === $(this).parents('.wcFrameTitle')[0]) {
          var panel = frame._panelList[index];
          if (self._removingPanel === panel) {
            self.removePanel(panel);
            self.__update();
          }
          return;
        }
      }
    });

    // Mouse down on a splitter bar will allow you to resize them.
    $('body').on('mousedown', '.wcSplitterBar', function(event) {
      if (event.which !== 1) {
        return true;
      }

      self.$container.addClass('wcDisableSelection');
      for (var i = 0; i < self._splitterList.length; ++i) {
        if (self._splitterList[i].$bar[0] === this) {
          self._draggingSplitter = self._splitterList[i];
          self._draggingSplitter.$pane[0].addClass('wcResizing');
          self._draggingSplitter.$pane[1].addClass('wcResizing');
          break;
        }
      }
      return true;
    });

    // Mouse down on a frame title will allow you to move them.
    $('body').on('mousedown', '.wcFrameTitle', function(event) {
      if (event.which === 3) {
        return true;
      }
      if ($(event.target).hasClass('wcFrameButton')) {
        return false;
      }
      
      self.$container.addClass('wcDisableSelection');
      for (var i = 0; i < self._frameList.length; ++i) {
        if (self._frameList[i].$title[0] == this) {
          self._draggingFrame = self._frameList[i];

          var mouse = {
            x: event.clientX,
            y: event.clientY,
          };
          self._draggingFrame.__anchorMove(mouse);

          var $panelTab = $(event.target).hasClass('wcPanelTab')? $(event.target): $(event.target).parent('.wcPanelTab'); 
          if ($panelTab && $panelTab.length) {
            var index = parseInt($panelTab.attr('id'));
            self._draggingFrame.panel(index, true);

            // if (event.which === 2) {
            //   self._draggingFrame = null;
            //   return;
            // }

            self._draggingFrameTab = $panelTab[0];
          }

          // If the window is able to be docked, give it a dark shadow tint and
          // begin the movement process
          if ((!self._draggingFrame.$title.hasClass('wcNotMoveable') && !$panelTab.hasClass('wcNotMoveable')) &&
          (!self._draggingFrame._isFloating || event.which !== 1 || self._draggingFrameTab)) {
            var rect = self._draggingFrame.__rect();
            self._ghost = new wcGhost(rect, mouse, self);
            self._draggingFrame.__checkAnchorDrop(mouse, true, self._ghost, true);
            self.trigger(wcDocker.EVENT.BEGIN_DOCK);
          }
          break;
        }
      }
      for (var i = 0; i < self._tabList.length; ++i) {
        if (self._tabList[i].$title[0] == this) {
          self._draggingCustomTabFrame = self._tabList[i];

          var $panelTab = $(event.target).hasClass('wcPanelTab')? $(event.target): $(event.target).parent('.wcPanelTab');
          if ($panelTab && $panelTab.length) {
            var index = parseInt($panelTab.attr('id'));
            self._draggingCustomTabFrame.tab(index, true);
            self._draggingFrameTab = $panelTab[0];
          }
          break;
        }
      }
      if (self._draggingFrame) {
        self.__focus(self._draggingFrame);
      }
      return true;
    });

    // Mouse down on a panel will put it into focus.
    $('body').on('mousedown', '.wcLayout', function(event) {
      if (event.which === 3) {
        return true;
      }
      for (var i = 0; i < self._frameList.length; ++i) {
        if (self._frameList[i].panel().layout().$table[0] == this) {
          setTimeout(function() {
            self.__focus(self._frameList[i]);
          }, 10);
          break;
        }
      }
      return true;
    });

    // Floating frames have resizable edges.
    $('body').on('mousedown', '.wcFrameEdge', function(event) {
      if (event.which === 3) {
        return true;
      }
      self.$container.addClass('wcDisableSelection');
      for (var i = 0; i < self._frameList.length; ++i) {
        if (self._frameList[i]._isFloating) {
          if (self._frameList[i].$top[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['top'];
            break;
          } else if (self._frameList[i].$bottom[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['bottom'];
            break;
          } else if (self._frameList[i].$left[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['left'];
            break;
          } else if (self._frameList[i].$right[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['right'];
            break;
          } else if (self._frameList[i].$corner1[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['top', 'left'];
            break;
          } else if (self._frameList[i].$corner2[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['top', 'right'];
            break;
          } else if (self._frameList[i].$corner3[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['bottom', 'right'];
            break;
          } else if (self._frameList[i].$corner4[0] == this) {
            self._draggingFrame = self._frameList[i];
            self._draggingFrameSizer = ['bottom', 'left'];
            break;
          }
        }
      }
      if (self._draggingFrame) {
        self.__focus(self._draggingFrame);
      }
      return true;
    });

    // Mouse move will allow you to move an object that is being dragged.
    $('body').on('mousemove', function(event) {
      if (event.which === 3) {
        return true;
      }
      if (self._draggingSplitter) {
        var mouse = {
          x: event.clientX,
          y: event.clientY,
        };
        self._draggingSplitter.__moveBar(mouse);
      } else if (self._draggingFrameSizer) {
        var mouse = {
          x: event.clientX,
          y: event.clientY,
        };

        var offset = self.$container.offset();
        mouse.x += offset.left;
        mouse.y += offset.top;

        self._draggingFrame.__resize(self._draggingFrameSizer, mouse);
        self._draggingFrame.__update();
      } else if (self._draggingFrame) {
        var mouse = {
          x: event.clientX,
          y: event.clientY,
        };

        if (self._ghost) {
          self._ghost.__move(mouse);

          var forceFloat = !(self._draggingFrame._isFloating || event.which === 1);
          var found = false;

          // Check anchoring with self.
          if (!self._draggingFrame.__checkAnchorDrop(mouse, true, self._ghost, self._draggingFrame._panelList.length > 1 && self._draggingFrameTab)) {
            self._draggingFrame.__shadow(true);
            if (!forceFloat) {
              for (var i = 0; i < self._frameList.length; ++i) {
                if (self._frameList[i] !== self._draggingFrame) {
                  if (self._frameList[i].__checkAnchorDrop(mouse, false, self._ghost, true)) {
                    // self._draggingFrame.__shadow(true);
                    return;
                  }
                }
              }
              for (var i = 0; i < self._drawerList.length; ++i) {
                if (self._drawerList[i].__checkAnchorDrop(mouse, false, self._ghost, true)) {
                  return;
                }
              }
            }

            self._ghost.anchor(mouse, null);
          } else {
            self._draggingFrame.__shadow(false);
            var $hoverTab = $(event.target).hasClass('wcPanelTab')? $(event.target): $(event.target).parent('.wcPanelTab');
            if (self._draggingFrameTab && $hoverTab && $hoverTab.length && self._draggingFrameTab !== event.target) {
              self._draggingFrameTab = self._draggingFrame.__tabMove(parseInt($(self._draggingFrameTab).attr('id')), parseInt($hoverTab.attr('id')));
            }
          }
        } else if (!self._draggingFrameTab) {
          self._draggingFrame.__move(mouse);
          self._draggingFrame.__update();
        }
      } else if (self._draggingCustomTabFrame) {
        var $hoverTab = $(event.target).hasClass('wcPanelTab')? $(event.target): $(event.target).parent('.wcPanelTab');
        if (self._draggingFrameTab && $hoverTab && $hoverTab.length && self._draggingFrameTab !== event.target) {
          self._draggingFrameTab = self._draggingCustomTabFrame.moveTab(parseInt($(self._draggingFrameTab).attr('id')), parseInt($hoverTab.attr('id')));
        }
      }
      return true;
    });

    // Mouse released
    $('body').on('mouseup', function(event) {
      if (event.which === 3) {
        return true;
      }
      self.$container.removeClass('wcDisableSelection');
      if (self._draggingFrame) {
        for (var i = 0; i < self._frameList.length; ++i) {
          self._frameList[i].__shadow(false);
        }
      }

      if (self._ghost && self._draggingFrame) {
        var anchor = self._ghost.anchor();

        if (!anchor) {
          var index = self._draggingFrame._curTab;
          if (!self._draggingFrameTab) {
            self._draggingFrame.panel(0);
          }

          var mouse = {
            x: event.clientX,
            y: event.clientY,
          };

          if (self._draggingFrameTab || !self.__isLastFrame(self._draggingFrame)) {
            var panel = self.movePanel(self._draggingFrame.panel(), wcDocker.DOCK.FLOAT);
            // Dragging the entire frame.
            if (!self._draggingFrameTab) {
              while (self._draggingFrame.panel())
              self.movePanel(self._draggingFrame.panel(), wcDocker.DOCK.STACKED, panel);
            }

            var frame = panel._parent;
            if (frame instanceof wcFrame) {
              frame.pos(mouse.x, mouse.y + self._ghost.__rect().h/2 - 10, true);
              frame.panel(index);

              frame._size.x = self._ghost.__rect().w;
              frame._size.y = self._ghost.__rect().h;
            }

            frame.__update();
          }
        } else if (!anchor.self) {
          var index = self._draggingFrame._curTab;
          if (!self._draggingFrameTab) {
            self._draggingFrame.panel(0);
          }
          var panel;
          if (anchor.item) {
            if (anchor.item instanceof wcDrawer) {
              panel = anchor.item;
            } else {
              panel = anchor.item._parent;
            }
          }
          // If we are dragging a tab to split its own container, find another
          // tab item within the same frame and split from there.
          if (panel === self._draggingFrame.panel()) {
            // Can not split the frame if it is the only panel inside.
            if (self._draggingFrame._panelList.length === 1) {
              return;
            }
            for (var i = 0; i < self._draggingFrame._panelList.length; ++i) {
              if (panel !== self._draggingFrame._panelList[i]) {
                panel = self._draggingFrame._panelList[i];
                index--;
                break;
              }
            }
          }
          panel = self.movePanel(self._draggingFrame.panel(), anchor.loc, panel, self._ghost.rect());
          panel._parent.panel(panel._parent._panelList.length-1, true);
          // Dragging the entire frame.
          if (!self._draggingFrameTab) {
            while (self._draggingFrame.panel()) {
              self.movePanel(self._draggingFrame.panel(), wcDocker.DOCK.STACKED, panel, self._ghost.rect());
            }
          } else {
            var frame = panel._parent;
            if (frame instanceof wcFrame) {
              index = index + frame._panelList.length;
            }
          }

          var frame = panel._parent;
          if (frame instanceof wcFrame) {
            frame.panel(index);
          }
        }
        self._ghost.destroy();
        self._ghost = null;

        self.trigger(wcDocker.EVENT.END_DOCK);
      }

      if ( self._draggingSplitter ) { 
        self._draggingSplitter.$pane[0].removeClass('wcResizing');
        self._draggingSplitter.$pane[1].removeClass('wcResizing');
      }

      self._draggingSplitter = null;
      self._draggingFrame = null;
      self._draggingFrameSizer = null;
      self._draggingFrameTab = null;
      self._draggingCustomTabFrame = null;
      self._removingPanel = null;
      return true;
    });

    // Middle mouse button on a panel tab to close it.
    $('body').on('mousedown', '.wcPanelTab', function(event) {
      if (event.which !== 2) {
        return;
      }

      var index = parseInt($(this).attr('id'));

      for (var i = 0; i < self._frameList.length; ++i) {
        var frame = self._frameList[i];
        if (frame.$title[0] === $(this).parents('.wcFrameTitle')[0]) {
          var panel = frame._panelList[index];
          self._removingPanel = panel;
          return;
        }
      }
    });
  },

  // Updates the sizing of all panels inside this window.
  __update: function(opt_dontMove) {
    if (this._root) {
      this._root.__update(opt_dontMove);
    }

    for (var i = 0; i < this._floatingList.length; ++i) {
      this._floatingList[i].__update();
    }
  },

  // On window resized event.
  __resize: function(event) {
    this._resizeData.time = new Date();
    if (!this._resizeData.timeout) {
      this._resizeData.timeout = true;
      setTimeout(this.__resizeEnd.bind(this), this._resizeData.delta);
      this.__trigger(wcDocker.EVENT.RESIZE_STARTED);
    }
    this.__trigger(wcDocker.EVENT.RESIZED);
    this.__update();
  },

  // On window resize event ended.
  __resizeEnd: function() {
    if (new Date() - this._resizeData.time < this._resizeData.delta) {
      setTimeout(this.__resizeEnd.bind(this), this._resizeData.delta);
    } else {
      this._resizeData.timeout = false;
      this.__trigger(wcDocker.EVENT.RESIZE_ENDED);
    }
  },

  // Brings a floating window to the top.
  // Params:
  //    frame     The frame to focus.
  //    flash     Whether to flash the frame.
  __focus: function(frame, flash) {
    var reorder = this._focusFrame != frame;
    if (this._focusFrame) {
      if (this._focusFrame._isFloating) {
        this._focusFrame.$frame.removeClass('wcFloatingFocus');
      }

      this._focusFrame.__trigger(wcDocker.EVENT.LOST_FOCUS);
      this._focusFrame = null;
    }

    this._focusFrame = frame;
    if (this._focusFrame) {
      if (this._focusFrame._isFloating) {
        this._focusFrame.$frame.addClass('wcFloatingFocus');

        if (reorder) {
          $('body').append(this._focusFrame.$frame);
        }
      }
      this._focusFrame.__focus(flash);

      this._focusFrame.__trigger(wcDocker.EVENT.GAIN_FOCUS);
    }
  },

  // Triggers an event exclusively on the docker and none of its panels.
  // Params:
  //    eventName   The name of the event.
  //    data        A custom data parameter to pass to all handlers.
  __trigger: function(eventName, data) {
    if (!eventName) {
      return;
    }

    if (this._events[eventName]) {
      for (var i = 0; i < this._events[eventName].length; ++i) {
        this._events[eventName][i].call(this, data);
      }
    }
  },

  // Checks a given panel to see if it is the final remaining
  // moveable panel in the docker.
  // Params:
  //    panel     The panel.
  // Returns:
  //    true      The panel is the last.
  //    false     The panel is not the last.
  __isLastPanel: function(panel) {
    for (var i = 0; i < this._frameList.length; ++i) {
      var testFrame = this._frameList[i];
      if (testFrame._isFloating || testFrame.isInDrawer()) {
        continue;
      }
      for (var a = 0; a < testFrame._panelList.length; ++a) {
        var testPanel = testFrame._panelList[a];
        if (testPanel !== panel && testPanel.moveable()) {
          return false;
        }
      }
    }

    return true;
  },

  // Checks a given frame to see if it is the final remaining
  // moveable frame in the docker.
  // Params:
  //    frame     The frame.
  // Returns:
  //    true      The panel is the last.
  //    false     The panel is not the last.
  __isLastFrame: function(frame) {
    for (var i = 0; i < this._frameList.length; ++i) {
      var testFrame = this._frameList[i];
      if (testFrame._isFloating || testFrame === frame || testFrame.isInDrawer()) {
        continue;
      }
      for (var a = 0; a < testFrame._panelList.length; ++a) {
        var testPanel = testFrame._panelList[a];
        if (testPanel.moveable()) {
          return false;
        }
      }
    }

    return true;
  },

  // For restore, creates the appropriate object type.
  __create: function(data, parent, $container) {
    switch (data.type) {
      case 'wcSplitter':
        var splitter = new wcSplitter($container, parent, data.horizontal);
        splitter.scrollable(0, false, false);
        splitter.scrollable(1, false, false);
        return splitter;

      case 'wcDrawer':
        var drawer = new wcDrawer($container, parent, data.position);
        this._drawerList.push(drawer);
        return drawer;

      case 'wcFrame':
        var frame = new wcFrame($container, parent, data.floating);
        this._frameList.push(frame);
        if (data.floating) {
          this._floatingList.push(frame);
        }
        return frame;

      case 'wcPanel':
        for (var i = 0; i < this._dockPanelTypeList.length; ++i) {
          if (this._dockPanelTypeList[i].name === data.panelType) {
            var panel = new wcPanel(data.panelType, this._dockPanelTypeList[i].options);
            panel._parent = parent;
            panel.__container(this.$transition);
            var options = (this._dockPanelTypeList[i].options && this._dockPanelTypeList[i].options.options) || {};
            panel._panelObject = new this._dockPanelTypeList[i].options.onCreate(panel, options);
            panel.__container($container);
            break;
          }
        }
        return panel;
    }

    return null;
  },

  // Attempts to insert a given dock panel into an already existing frame.
  // If insertion is not possible for any reason, the panel will be
  // placed in its own frame instead.
  // Params:
  //    panel         The panel to insert.
  //    parentPanel   An optional panel to 'split', if not supplied the
  //                  new panel will split the center window.
  __addPanelGrouped: function(panel, parentPanel) {
    if (parentPanel instanceof wcPanel) {
      var frame = parentPanel._parent;
      if (frame instanceof wcFrame) {
        frame.addPanel(panel);
        return;
      }
    } else if (parentPanel instanceof wcFrame) {
      parentPanel.addPanel(panel);
      return;
    }

    // If we did not manage to find a place for this panel, last resort is to put it in its own frame.
    this.__addPanelAlone(panel, wcDocker.DOCK.LEFT, parentPanel, null);
  },

  // Creates a new frame for the panel and then attaches it
  // to the window.
  // Params:
  //    panel         The panel to insert.
  //    location      The desired location for the panel.
  //    parentPanel  An optional panel to 'split', if not supplied the
  //                  new panel will split the center window.
  __addPanelAlone: function(panel, location, parentPanel, rect) {
    if (rect) {
      var width = this.$container.width();
      var height = this.$container.height();

      if (rect.hasOwnProperty('x')) {
        rect.x = this.__stringToPixel(rect.x, width);
      }
      if (rect.hasOwnProperty('y')) {
        rect.y = this.__stringToPixel(rect.y, height);
      }
      if (!rect.hasOwnProperty('w')) {
        rect.w = panel.initSize().x;
      }
      if (!rect.hasOwnProperty('h')) {
        rect.h = panel.initSize().y;
      }
      rect.w = this.__stringToPixel(rect.w, width);
      rect.h = this.__stringToPixel(rect.h, height);
    }

    // Floating windows need no placement.
    if (location === wcDocker.DOCK.FLOAT || location === wcDocker.DOCK.MODAL) {
      var frame = new wcFrame(this.$container, this, true);
      this._frameList.push(frame);
      this._floatingList.push(frame);
      this.__focus(frame);
      frame.addPanel(panel);
      frame.pos(panel._pos.x, panel._pos.y, false);

      if (location === wcDocker.DOCK.MODAL) {
        frame.$modalBlocker = $('<div class="wcModalBlocker"></div>');
        frame.$frame.prepend(frame.$modalBlocker);

        panel.moveable(false);
        frame.$frame.addClass('wcModal');
        this._modalList.push(frame);
      }

      if (rect) {
        var pos = frame.pos(undefined, undefined, true);
        if (rect.hasOwnProperty('x')) {
          pos.x = rect.x + rect.w/2;
        }
        if (rect.hasOwnProperty('y')) {
          pos.y = rect.y + rect.h/2;
        }
        frame.pos(pos.x, pos.y, true);
        frame._size = {
          x: rect.w,
          y: rect.h,
        };
      }
      return;
    }

    if (parentPanel) {
      var parentFrame = parentPanel._parent;
      if (parentFrame instanceof wcFrame) {
        var parentSplitter = parentFrame._parent;
        if (parentSplitter instanceof wcSplitter) {
          var splitter;
          var left  = parentSplitter.pane(0);
          var right = parentSplitter.pane(1);
          var size = {
            x: -1,
            y: -1,
          };
          if (left === parentFrame) {
            splitter = new wcSplitter(this.$transition, parentSplitter, location !== wcDocker.DOCK.BOTTOM && location !== wcDocker.DOCK.TOP);
            parentSplitter.pane(0, splitter);
            size.x = parentSplitter.$pane[0].width();
            size.y = parentSplitter.$pane[0].height();
          } else {
            splitter = new wcSplitter(this.$transition, parentSplitter, location !== wcDocker.DOCK.BOTTOM && location !== wcDocker.DOCK.TOP);
            parentSplitter.pane(1, splitter);
            size.x = parentSplitter.$pane[1].width();
            size.y = parentSplitter.$pane[1].height();
          }

          if (splitter) {
            splitter.scrollable(0, false, false);
            splitter.scrollable(1, false, false);
            frame = new wcFrame(this.$transition, splitter, false);
            this._frameList.push(frame);
            if (location === wcDocker.DOCK.LEFT || location === wcDocker.DOCK.TOP) {
              splitter.pane(0, frame);
              splitter.pane(1, parentFrame);
            } else {
              splitter.pane(0, parentFrame);
              splitter.pane(1, frame);
            }

            if (!rect) {
              rect = {
                w: panel._size.x,
                h: panel._size.y,
              };
            }

            if (rect) {
              if (rect.w < 0) {
                rect.w = size.x/2;
              }
              if (rect.h < 0) {
                rect.h = size.y/2;
              }

              switch (location) {
                case wcDocker.DOCK.LEFT:
                  splitter.pos(rect.w / size.x);
                  break;
                case wcDocker.DOCK.RIGHT:
                  splitter.pos(1.0 - (rect.w / size.x));
                  break;
                case wcDocker.DOCK.TOP:
                  splitter.pos(rect.h / size.y);
                  break;
                case wcDocker.DOCK.BOTTOM:
                  splitter.pos(1.0 - (rect.h / size.y));
                  break;
              }
            } else {
              splitter.pos(0.5);
            }

            frame.addPanel(panel);
          }
          return;
        } else if (parentSplitter instanceof wcDrawer) {
          parentPanel = parentSplitter;
        }
      }
    }

    var parent = this;
    var $container = this.$container;
    if (parentPanel && parentPanel instanceof wcDrawer) {
      parent = parentPanel;
      $container = parentPanel.$drawer;
    }

    var frame = new wcFrame(this.$transition, parent, false);
    this._frameList.push(frame);

    if (!parent._root) {
      parent._root = frame;
      frame.__container($container);
    } else {
      var splitter = new wcSplitter($container, parent, location !== wcDocker.DOCK.BOTTOM && location !== wcDocker.DOCK.TOP);
      if (splitter) {
        frame._parent = splitter;
        splitter.scrollable(0, false, false);
        splitter.scrollable(1, false, false);
        var size = {
          x: $container.width(),
          y: $container.height(),
        };

        if (location === wcDocker.DOCK.LEFT || location === wcDocker.DOCK.TOP) {
          splitter.pane(0, frame);
          splitter.pane(1, parent._root);
        } else {
          splitter.pane(0, parent._root);
          splitter.pane(1, frame);
        }

        if (!rect) {
          splitter.__findBestPos();
        } else {
          if (rect.w < 0) {
            rect.w = size.x/2;
          }
          if (rect.h < 0) {
            rect.h = size.y/2;
          }

          switch (location) {
            case wcDocker.DOCK.LEFT:
              splitter.pos(rect.w / size.x);
              break;
            case wcDocker.DOCK.RIGHT:
              splitter.pos(1.0 - (rect.w / size.x));
              break;
            case wcDocker.DOCK.TOP:
              splitter.pos(rect.h / size.y);
              break;
            case wcDocker.DOCK.BOTTOM:
              splitter.pos(1.0 - (rect.h / size.y));
              break;
          }
        }

        parent._root = splitter;
      }
    }

    frame.addPanel(panel);
  },

  // Adds the placeholder panel as needed
  __addPlaceholder: function(targetPanel) {
    if (this._placeholderPanel) {
      console.log('WARNING: wcDocker creating placeholder panel when one already exists');
    }
    this._placeholderPanel = new wcPanel(wcDocker.PANEL_PLACEHOLDER_NAME, {});
    this._placeholderPanel._isPlaceholder = true;
    this._placeholderPanel._parent = this;
    this._placeholderPanel.__container(this.$transition);
    this._placeholderPanel._panelObject = new function(myPanel) {
      myPanel.title(false);
      myPanel.closeable(false);
    }(this._placeholderPanel);

    if (targetPanel) {
      this.__addPanelGrouped(this._placeholderPanel, targetPanel);
    } else {
      this.__addPanelAlone(this._placeholderPanel, wcDocker.DOCK.TOP);
    }

    this.__update();
  },

  // Converts a potential string value to a percentage.
  __stringToPercent: function(value, size) {
    if (typeof value === 'string') {
      if (value.indexOf('%', value.length - 1) !== -1) {
        return parseFloat(value)/100;
      } else if (value.indexOf('px', value.length - 2) !== -1) {
        return parseFloat(value) / size;
      }
    }
    return parseFloat(value);
  },

  // Converts a potential string value to a pixel value.
  __stringToPixel: function(value, size) {
    if (typeof value === 'string') {
      if (value.indexOf('%', value.length - 1) !== -1) {
        return (parseFloat(value)/100) * size;
      } else if (value.indexOf('px', value.length - 2) !== -1) {
        return parseFloat(value);
      }
    }
    return parseFloat(value);
  },

};
