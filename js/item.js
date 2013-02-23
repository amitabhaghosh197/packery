/**
 * Packery Item Element
**/

( function( window ) {

'use strict';

// dependencies
var Packery = window.Packery;
var Rect = Packery.Rect;
var getSize = window.getSize;
var getStyleProperty = window.getStyleProperty;
var EventEmitter = window.EventEmitter;

// ----- get style ----- //

var defView = document.defaultView;

var getStyle = defView && defView.getComputedStyle ?
  function( elem ) {
    return defView.getComputedStyle( elem, null );
  } :
  function( elem ) {
    return elem.currentStyle;
  };


// extend objects
function extend( a, b ) {
  for ( var prop in b ) {
    a[ prop ] = b[ prop ];
  }
  return a;
}

// -------------------------- CSS3 support -------------------------- //

var transitionProperty = getStyleProperty('transition');
var transformProperty = getStyleProperty('transform');
var supportsCSS3 = transitionProperty && transformProperty;
var is3d = !!getStyleProperty('perspective');

var transitionEndEvent = {
  WebkitTransition: 'webkitTransitionEnd',
  MozTransition: 'transitionend',
  OTransition: 'otransitionend',
  transition: 'transitionend'
}[ transitionProperty ];

var transformCSSProperty = {
  WebkitTransform: '-webkit-transform',
  MozTransform: '-moz-transform',
  OTransform: '-o-transform',
  transform: 'transform'
}[ transformProperty ];

// -------------------------- Item -------------------------- //

function Item( element, packery ) {
  this.element = element;
  this.packery = packery;
  this.position = {
    x: 0,
    y: 0
  };

  this.rect = new Rect();

  // style initial style
  this.element.style.position = 'absolute';
}

// inherit EventEmitter
extend( Item.prototype, EventEmitter.prototype );

Item.prototype.handleEvent = function( event ) {
  var method = event.type + 'Handler';
  if ( this[ method ] ) {
    this[ method ]( event );
  }
};

Item.prototype.getSize = function() {
  this.size = getSize( this.element );
};

/**
 * apply CSS styles to element
 * @param {Object} style
 */
Item.prototype.css = function( style ) {
  var elemStyle = this.element.style;
  for ( var prop in style ) {
    elemStyle[ prop ] = style[ prop ];
  }
};

 // measure position, and sets it
Item.prototype.getPosition = function() {
  var style = getStyle( this.element );

  var x = parseInt( style.left, 10 );
  var y = parseInt( style.top, 10 );

  // clean up 'auto' or other non-integer values
  x = isNaN( x ) ? 0 : x;
  y = isNaN( y ) ? 0 : y;
  // remove padding from measurement
  var packerySize = this.packery.elementSize;
  x -= packerySize.paddingLeft;
  y -= packerySize.paddingTop;

  this.position.x = x;
  this.position.y = y;
};

// transform translate function
var translate = is3d ?
  function( x, y ) {
    return 'translate3d( ' + x + 'px, ' + y + 'px, 0)';
  } :
  function( x, y ) {
    return 'translate( ' + x + 'px, ' + y + 'px)';
  };


Item.prototype._transitionTo = function( x, y ) {
  this.getPosition();
  // get current x & y from top/left
  var curX = this.position.x;
  var curY = this.position.y;

  var compareX = parseInt( x, 10 );
  var compareY = parseInt( y, 10 );
  var didNotMove = compareX === this.position.x && compareY === this.position.y;

  // save end position
  this.setPosition( x, y );

  // if did not move and not transitioning, just go to layout
  if ( didNotMove && !this.isTransitioning ) {
    this.layoutPosition();
    return;
  }

  var transX = x - curX;
  var transY = y - curY;
  var transitionStyle = {};
  transitionStyle[ transformCSSProperty ] = translate( transX, transY );

  this.transition( transitionStyle, this.layoutPosition );
};

// non transition + transform support
Item.prototype.goTo = function( x, y ) {
  this.setPosition( x, y );
  this.layoutPosition();
};

// use transition and transforms if supported
Item.prototype.moveTo = supportsCSS3 ?
  Item.prototype._transitionTo : Item.prototype.goTo;

Item.prototype.setPosition = function( x, y ) {
  this.position.x = parseInt( x, 10 );
  this.position.y = parseInt( y, 10 );
};

Item.prototype.layoutPosition = function() {
  var packerySize = this.packery.elementSize;
  this.css({
    // set settled position, apply padding
    left: ( this.position.x + packerySize.paddingLeft ) + 'px',
    top : ( this.position.y + packerySize.paddingTop ) + 'px'
  });
  this.emitEvent( 'layout', [ this ] );
};

/**
 * @param {Object} style - CSS
 * @param {Function} onTransitionEnd
 */

// non transition, just trigger callback
Item.prototype._nonTransition = function( style, onTransitionEnd ) {
  this.css( style );
  if ( onTransitionEnd ) {
    onTransitionEnd.call( this );
  }
};

// proper transition
Item.prototype._transition = function( style, onTransitionEnd ) {
  this.transitionStyle = style;

  var transitionValue = [];
  for ( var prop in style ) {
    transitionValue.push( prop );
  }

  // enable transition
  style[ transitionProperty + 'Property' ] = transitionValue.join(',');
  style[ transitionProperty + 'Duration' ] = this.packery.options.transitionDuration;

  this.element.addEventListener( transitionEndEvent, this, false );

  // transition end callback
  this.onTransitionEnd = onTransitionEnd;

  // set transition styles
  this.css( style );

  this.isTransitioning = true;
};

Item.prototype.transition = Item.prototype[ transitionProperty ? '_transition' : '_nonTransition' ];

Item.prototype.webkitTransitionEndHandler = function( event ) {
  this.transitionendHandler( event );
};

Item.prototype.otransitionendHandler = function( event ) {
  this.transitionendHandler( event );
};

Item.prototype.transitionendHandler = function( event ) {
  // console.log('transition end');
  // disregard bubbled events from children
  if ( event.target !== this.element ) {
    return;
  }

  // trigger callback
  if ( this.onTransitionEnd ) {
    this.onTransitionEnd();
    delete this.onTransitionEnd;
  }

  this.removeTransitionStyles();
  // clean up transition styles
  var cleanStyle = {};
  for ( var prop in this.transitionStyle ) {
    cleanStyle[ prop ] = '';
  }

  this.css( cleanStyle );

  this.element.removeEventListener( transitionEndEvent, this, false );

  delete this.transitionStyle;

  this.isTransitioning = false;

};

Item.prototype.removeTransitionStyles = function() {
  var noTransStyle = {};
  // remove transition
  noTransStyle[ transitionProperty + 'Property' ] = '';
  noTransStyle[ transitionProperty + 'Duration' ] = '';
  this.css( noTransStyle );
};

Item.prototype.remove = function() {
  console.log('hiding');
  // start transition

  var hiddenStyle = {
    opacity: 0
  };
  hiddenStyle[ transformCSSProperty ] = 'scale(0.001)';

  this.transition( hiddenStyle, this.removeElem );

};


// remove element from DOM
Item.prototype.removeElem = function() {
  console.log('removing elem');
  this.element.parentNode.removeChild( this.element );
  this.emitEvent( 'remove', [ this ] );
};

Item.prototype.reveal = !transitionProperty ? function() {} : function() {
  // hide item
  var hiddenStyle = {
    opacity: 0
  };
  hiddenStyle[ transformCSSProperty ] = 'scale(0.001)';
  this.css( hiddenStyle );
  // force redraw. http://blog.alexmaccaw.com/css-transitions
  var h = this.element.offsetHeight;
  // transition to revealed
  var visibleStyle = {
    opacity: 1
  };
  visibleStyle[ transformCSSProperty ] = 'scale(1)';
  this.transition( visibleStyle );
  // hack for JSHint to hush about unused var
  h = null;
};

Item.prototype.destroy = function() {
  this.css({
    position: '',
    left: '',
    top: ''
  });
};

// -------------------------- drag -------------------------- //

Item.prototype.dragStart = function() {
  this.getPosition();
  this.removeTransitionStyles();
  // remove transform property from transition
  if ( this.isTransitioning && transformProperty ) {
    this.element.style[ transformProperty ] = 'none';
  }
  this.getSize();
  // create drag rect, used for position when dropped
  this.dragRect = new Rect();
  this.needsPositioning = false;
  var packerySize = this.packery.elementSize;
  var dragX = this.position.x + packerySize.paddingLeft;
  var dragY = this.position.y + packerySize.paddingTop;
  this.positionDragRect( dragX, dragY );
  this.isTransitioning = false;
  this.didDrag = false;
};

/**
 * handle item when it is dragged
 * @param {Number} x - horizontal position of dragged item
 * @param {Number} y - vertical position of dragged item
 */
Item.prototype.dragMove = function( x, y ) {
  this.didDrag = true;
  this.positionDragRect( x, y );
};

// position a rect that will occupy space in the packer
Item.prototype.positionDragRect = function( x, y ) {
  var packerySize = this.packery.elementSize;
  x -= packerySize.paddingLeft;
  y -= packerySize.paddingTop;
  var packeryHeight = Math.max( packerySize.innerHeight, this.packery.maxY );

  this.dragRect.x = this.getDragRectCoord( x, this.size.outerWidth, packerySize.innerWidth, this.packery.columnWidth );
  this.dragRect.y = this.getDragRectCoord( y, this.size.outerHeight, packeryHeight, this.packery.rowHeight );
};

/**
 * get x/y coordinate for drag rect
 * @param {Number} coord - x or y
 * @param {Number} size - size of item
 * @param {Number} parentsize - size of parent packery
 * @param {Number} segment - size of columnWidth or rowHeight
 * @returns {Number} coord - processed x or y
 */
Item.prototype.getDragRectCoord = function( coord, size, parentSize, segment ) {
  var max; // outer bound
  if ( segment ) {
    segment += this.packery.gutter;
    // snap to closest segment
    coord = Math.round( coord / segment ) * segment;
    // contain to outer bound
    var maxSegments = Math.ceil( parentSize / segment ) - 1;
    maxSegments -= Math.ceil( size / segment );
    max = maxSegments * segment;
  } else {
    max = parentSize - size;
  }
  // must be between 0 and outer bound
  return Math.max( 0, Math.min( coord, max ) );
};

Item.prototype.dragStop = function() {
  this.getPosition();
  var isDiffX = this.position.x !== this.dragRect.x;
  var isDiffY = this.position.y !== this.dragRect.y;
  // set post-drag positioning flag
  this.needsPositioning = isDiffX || isDiffY;
  // reset flag
  this.didDrag = false;
};

// --------------------------  -------------------------- //

// publicize
Packery.Item = Item;

})( window );

