/** @license
MIT License

Copyright (c) 2017 Mitsutaka Okazaki

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/**
 * @private
 */
function __debug(name, object) {
	console.log(name + "=" + JSON.stringify(object));
}

/**
 * @private
 */
function _geometricProgression(t,r=0.985,a=1) {
	return a * (1-Math.pow(r,t)) / (1 - r);
}

/**
 * @private
 */
function _limitSpring(min, offset, max, k=1) {
	if(offset < min) {
		let t = min - offset;
		return min - _geometricProgression(t)/k;
	} else if(max < offset) {
		let t = offset - max;
		return max + _geometricProgression(t)/k;
	} else {
		return offset;
	}
}

/**
 * @private
 */
function _toPX(number) {
	return number + "px";
}

/**
 * Convert relative percent length to absolute pixel.
 * @private
 */
function _toAbsLength(base, value) {
	if(typeof value == 'string' && value.charAt(value.length-1) == '%') {
		let s = value.substring(0,value.length-1);
		return base * Number(s) / 100;
	}
	return Number(value);
}

function _scaleRect(rect, scale) {
	return {
		x: rect.x * scale,
		y: rect.y * scale,
		width: rect.width * scale,
		height: rect.height * scale
	};
}

/**
 * A Javascript ScrollView module with pan and pinch support. Hammer.js is required. 
 */
class JScrollView {
	/**
	 * @param {HtmlDivElement|string} container The DIV element or id or selector string that specifies a DIV element. 
	 *   JScrollView's root container is attached to the element. If the given DIV already contains child elements, 
	 *   they are moved into the content root element of the scroll view. To attach the content element by code, 
	 *   use `setContent(content)` method instead.
	 * @param {Object} [options] 
	 * @param {Object} [options.contentOffset] 
	 * @param {number} [options.contentOffset.x=0] The X offset of the content.
	 * @param {number} [options.contentOffset.y=0] The Y offset of the content.
	 * @param {Object} [options.contentMargin]
	 * @param {number|string} [options.contentMargin.top='auto'] The top margin of the content. number, percentage or `'auto'`.
	 * @param {number|string} [options.contentMargin.left='auto'] The left margin of the content. number, percentage or `'auto'`.
	 * @param {number|string} [options.contentMargin.bottom='auto'] The bottom margin of the content. number, percentage or `'auto'`.
	 * @param {number|string} [options.contentMargin.right='auto'] The right margin of the content. number, percentage or `'auto'`.	 
	 * @param {number} [options.zoomScale=1.0]
	 * @param {boolean} [options.checkDobuleTapFailure=false] 
	 * - true to handle single tap event only if double tap gesture recognizer fails.
	 * - false to handle single and double tap event simultaneously.
	 * @param {number} [options.minimumZoomScale=0.5]
	 * @param {number} [options.maximumZoomScale=5.5]
	 * @param {string} [options.scrollBounce='auto'] 
	 * - 'off' to disable scroll bounce.
	 * - 'on' to enable scroll bounce.
	 * - 'auto' to disable scroll bounce if the content size is smaller than the view size.
	 * @param {boolean} [options.watchResize=true] 
	 * - true to watch the window resize event and do layout process automatically.
     * - false to stop watching the event.
	 */
	constructor(container, options) {
		options = options || {};
		this._baseContentSize = null;
		this._marginInPixel = null;
		this._contentAdjust = {x:0,y:0};
		this._contentOffset = Object.assign({x:0,y:0}, options.contentOffset);
		this._contentMargin = Object.assign({top:'auto',left:'auto',bottom:'auto',right:'auto'}, options.contentMargin);
		this._zoomScale = options.zoomScale || 1.0;
		this._wheelZoomScale = options.wheelZoomScale || 1.1;
		this._minimumZoomScale = options.minimumZoomScale || 0.5;
		this._maximumZoomScale = options.maximumZoomScale || 5.5;
		this._checkDoubleTapFailure = options.checkDoubleTapFailure || false;
		this._watchResize = options.watchResize || true;
		this._scrollBounce = options.scrollBounce || 'auto';

		if(typeof(container) === 'string') {
			container = document.getElementById(container) || document.querySelector(container);
			if(container == null) {
				throw new Error('Missing container: ' + container);
			}
		}
		container.style.overflow = 'hidden';

		let contentRoot = document.createElement('div');
		contentRoot.id = '__jscrollview_root_';
		contentRoot.style.position = 'absolute';
		contentRoot.style.width = '100%';
		contentRoot.style.height = '100%'
		contentRoot.style.transformOrigin = "top left";
		let children = container.children;
		for(let i=0; i<children.length; i++) {
			contentRoot.appendChild(children[i]);
		}
		container.appendChild(contentRoot);
		this._contentRoot = contentRoot;
		this._container = container;

		this._installGestureRecognizer(container, options);
		this._resizeListener = (evt)=> {
			this._containerWidth = this._container.clientWidth;
			this._containerHeight = this._container.clientHeight;
			this.invalidateSize();
			this.setNeedsLayout();
		};
		if(this._watchResize) {
			window.addEventListener('resize', this._resizeListener);
		}
		this._resizeListener();
	}

	_installGestureRecognizer(container, options) {

		let mc = new Hammer.Manager(container,{});
		let doubleTap = new Hammer.Tap({event:'doubletap',taps:2,threshold:5});
		let singleTap = new Hammer.Tap({event:'singletap'});
		let pan = new Hammer.Pan({direction: Hammer.DIRECTION_ALL});
		let pinch = new Hammer.Pinch();

		mc.add([doubleTap,singleTap,pan,pinch]);

		doubleTap.recognizeWith(singleTap);
		if(options.checkDoubleTapFailure) {
			singleTap.requireFailure(doubleTap);
		}
		pinch.recognizeWith(pan);

		mc.on("singletap", (evt)=>{this._handleSingleTap(evt);evt.preventDefault()});
		mc.on("doubletap", (evt)=>{this._handleDoubleTap(evt);evt.preventDefault()});
		mc.on("panstart panmove panend pancancel", (evt)=>{this._handlePan(evt);evt.preventDefault()});
		mc.on("pinchstart pinchmove pinchend pinchcancel", (evt)=>{this._handlePinch(evt);evt.preventDefault()});

		this._mouseWheelListener = (evt)=>{this._handleMouseWheel(evt);evt.preventDefault()}		
		container.addEventListener('mousewheel',this._mouseWheelListener);

		this._gestureDelegate = {};
		this._mc = mc;
	}

	/**
	 * Get the container DIV element which bound to this view.
	 * @returns {HTMLDivElement}
	 */
	getContainer() {
		return this._container;
	}

	/**
	 * Get the view's internal Hammer.Manager instance that bound to the view's container.
	 * @returns {Hammer.Manager} the gesture controller instance.
	 */
	getHammer() {
		return this._mc;		
	}

	/**
	 * Destroy the view and unbinds all events. It does not destroy the content element. 
	 * To remove the content element is the user own responsibility.
	 */
	destroy() {
		this._container.removeEventListener('mousewheel',this._mouseWheelListener);
		window.removeEventListener('resize',this._resizeListener);
		this._mc.destroy();
		this._container = null;
	}

	/**
     * Set the delegate object to intercept gesture events and customize the JScrollView's default behavior.
     * All methods on the delegate object can return a boolean value. If the method returns true, 
     * the default action of JScrollView will be cancelled.
     * @param {Object} delegate
     * @param {HammerEventHandler} delegate.handleSingleTap
     * @param {HammerEventHandler} delegate.handleDoulbeTap
     * @param {HammerEventHandler} delegate.handlePan
     * @param {HammerEventHandler} delegate.handlePinch
	 */
	setGestureDelegate(delegate) {
		this._gestureDelegate = delegate || {};
	}

	/**
	 * Set content element to this view. The previous content that already set to this view will be removed.
	 * @param {HtmlElement|Object} content - A HtmlElement or an object which implements `toHtmlElement()` function.
	 */
	setContent(content) {
		if(typeof content['toHtmlElement'] === 'function') {
			content = content['toHtmlElement']();
		}
		this._contentRoot.innerHTML = '';
		this._contentRoot.appendChild(content);
		this.invalidateSize();
		this.setNeedsLayout();
	}

	/**
	 * Invalidates inner layout of the view.
	 * This method should be called if the view or content size is changed.
	 */
	invalidateSize() {
		this._baseContentSize = null;
		this._marginInPixel = null;
	}

	/** set/get the content margin.
	 * @param {Object} [margin]
	 * @param {number|string} [margin.top='auto'] The top margin of the content. number or `'auto'`.
	 * @param {number|string} [margin.left='auto'] The left margin of the content. number or `'auto'`.
	 * @param {number|string} [margin.bottom='auto'] The bottom margin of the content. number or `'auto'`.
	 * @param {number|string} [margin.right='auto'] The right margin of the content. number or `'auto'`.	 
	 */
	contentMargin(margin) {
		if(margin != null) {
			if(margin.top != null) this._contentMargin.top = margin.top;
			if(margin.left != null) this._contentMargin.left = margin.left;
			if(margin.bottom != null) this._contentMargin.bottom = margin.bottom;
			if(margin.right != null) this._contentMargin.right = margin.right;
		} else {
			return {
				top:this._contentMargin.top,
				left:this._contentMargin.left,
				bottom:this._contentMargin.bottom,
				right:this._contentMargin.right,
			};
		}
	}

	/**
	 * set/get the offset from the content origin.
	 * @param {Point} offset - offset from the content origin.
	 * @returns {(Point|undefined)}
	 * @example
	 * ```
	 * // get content offset
	 * var offset = view.contentOffset();
	 * 
	 * // set content offset
	 * view.contentOffset({x:20,y:50});
	 * ```
	 */
	contentOffset(offset) {
		if(offset != null) {
			if(offset.x != null) this._contentOffset.x = offset.x;
			if(offset.y != null) this._contentOffset.y = offset.y;
			this.setNeedsLayout();
		} else {
			return {
				x: this._contentOffset.x,
				y: this._contentOffset.y
			}
		}
	}

	/**
	 * set/get the offset from the content origin.
	 * @param {Point} offset - offset from the content origin.
	 * @param {boolean} [animated] - true to animate the transition to the new offset, false to make it immediate. 
	 */
	setContentOffset(offset, animated) {
		if(offset.x != null) this._contentOffset.x = offset.x;
		if(offset.y != null) this._contentOffset.y = offset.y;
		this.layout(animated?0.25:0);
	}

	/**
	 * set/get a floating-point value that specifies the relative scale factor for mouse wheel zooming.
	 * @param {number} [scale] relative scale factor 
	 * @returns {(number|undefined)}
	 */
	wheelZoomScale(scale) {
		if(scale != null) {
			this._wheelZoomScale = scale;
		} else {
			return this._wheelZoomScale;
		}		
	}

	/**
	 * set/get a floating-point value that specifies the current scale factor applied to the view's content.
	 * @param {number} [scale] scale factor 
	 * @returns {(number|undefined)}
	 */
	zoomScale(scale) {
		if(scale != null) {
			this._zoomScale = scale;
			this.setNeedsLayout();
		} else {
			return this._zoomScale;
		}
	}

	/**
	 * set the current scale factor applied to the view's content.
	 * @param {number} scale scale factor
	 * @param {boolean} [animated] true to animate the transition to the new scale, false to make it immediate.
	 */
	setZoomScale(scale, animated) {
		this._zoomScale = scale;
		this.layout(animated?0.25:0);
	}

	/**
	 * set the current scale factor and the offset from the view's content
	 * @param {Point} offset 
	 * @param {number} scale scale factor
	 * @param {boolean} [animated] true to animate the transition, false to make it immediate.
	 */
	setContentOffsetAndZoomScale(offset, scale, animated) {
		if(offset.x != null) this._contentOffset.x = offset.x;
		if(offset.y != null) this._contentOffset.y = offset.y;
		this._zoomScale = scale;
		this.layout(animated?0.25:0);
	}

	/**
	 * set/get a floating-point value that specifies the minimum scale factor that applied to the view's content.
	 * @param {number} [scale] 
	 * @returns {(number|undefined)} 
	 */
	minimumZoomScale(scale) {
		if(scale != null) {
			this._minimumZoomScale = scale;
		} else {
			return this._minimumZoomScale;
		}
	}

	/**
	 * set/get a floating-point value that specifies the maximum scale factor that applied to the view's content.
	 * @param {number} [scale] 拡大率の最大値
	 * @returns {(number|undefined)} 
	 */
	maximumZoomScale(scale) {
		if(scale != null) {
			this._maximumZoomScale = scale;
		} else {
			return this._maximumZoomScale;
		}		
	}

	/**
	 * Invalidates the current layout of the view, and update the layout during the next update cycle.
	 */
	setNeedsLayout() {
		if(this._layoutTimerId == null) {
		 	this._layoutTimerId = setTimeout( () => {
		 		this.layout();			
		 		this._layoutTimerId = null;
		 	}, 0);
		}
	}

	/**
	 * Update the view's layout
	 * @param {number} [duration] the time of the transition animation. 0 to make the transition immediate.
	 */
	layout(duration=0) {

		if (this._containterWidth == 0 || this._containerHeight == 0) {
			console.log("Fatal Error: invalid container size. " + this._containerWidth + "x" + this._containerHeight);
			return;
		}

		if (0 < duration) {
			if(this._layoutTimerId != null)  {
				clearTimeout(this._layoutTimerId);
				this._layoutTimerId = null;
			}

			this._contentRoot.style.transition = [
				"transform " + duration + "s"
			].join(',');

		} else {
			this._contentRoot.style.transition = "none";
		}

		let contentAdjust = this._calcContentAdjust(this._zoomScale);

		let left = _toPX(contentAdjust.x - this._contentOffset.x);
		let top  = _toPX(contentAdjust.y - this._contentOffset.y);
		let transform = [
			"translate(" + left + "," + top + ")",
			"scale(" + this._zoomScale.toFixed(4) + ")"
		].join(" ");
		this._contentRoot.style.transform = transform;
	}

	/**
	 * Get the size of the content at the current scale factor. The size of the content is computed
	 * from the content and its children. There is no method to set the size of the content.
	 * @returns {Size} The size of the content.
	 */
	getContentSize() {
		return this._calcContentSize(this._zoomScale);
	}

	_calcMarginInPixel() {
		if(this._marginInPixel == null) {
			this._marginInPixel = {
				top:_toAbsLength(this._containerHeight, this._contentMargin.top),
				left:_toAbsLength(this._containerWidth, this._contentMargin.left),
				bottom:_toAbsLength(this._containerHeight, this._contentMargin.bottom),
				right:_toAbsLength(this._containerWidth, this._contentMargin.right),
			};
		}
		return this._marginInPixel;
	}


	/** 
	 * Calculate additional offset of the content that applied if the content size is smaller than view's size.
	 * @param {number} scale - A flooting-point value that specifies the scale factor of the content.
	 * @private
	 */
	_calcContentAdjust(scale) {
		let size = this._calcContentSize(scale);

		let _adjust = (containerWidth, contentWidth, marginLeft, marginRight) => {
			let x;
			if(isNaN(marginLeft) && !isNaN(marginRight)) {
				x = (containerWidth - contentWidth - marginRight)/scale;
			} else if(!isNaN(marginLeft) && isNaN(marginRight)) {
				x = marginLeft / scale;
			} else if(!isNaN(marginLeft) && !isNaN(marginRight)) {
				x = (containerWidth - contentWidth - marginRight) / scale;
				x = Math.max(x, marginLeft / scale);
			} else {
				x = Math.max(0, (containerWidth - contentWidth)/2);
			}
			return x;
		}

		let margin = this._calcMarginInPixel();
		let ret = {
			x: _adjust(this._containerWidth, size.width, margin.left, margin.right),
			y: _adjust(this._containerHeight, size.height, margin.top, margin.bottom)
		};

		return ret;
	}

	/**
	 * Calculate the size of the content at a specified scale factor.
	 * @param {number} scale - A flooting-point value that specifies the scale factor of the content.
	 * @private
	 */
	_calcContentSize(scale) {
		let size = 	this._calcBaseContentSize();
		return {width:size.width*scale,height:size.height*scale};
	}

	/**
	 * Calculate the size of the content at the scale factor 1.0.
	 * @private
	 */
	_calcBaseContentSize() {
		if(this._baseContentSize == null) {
			let w=0,h=0;
			let elements = this._contentRoot.children;
			for(let i=0; i<elements.length; i++) {
				let child = elements[i];
				w = Math.max(w, (child.offsetLeft + child.offsetWidth));
				h = Math.max(h, (child.offsetTop + child.offsetHeight));
			}
			this._baseContentSize = {width:w, height:h};
		}
		return {
			width:this._baseContentSize.width,
			height:this._baseContentSize.height
		};
	}

	_getContainerOffset() {
		let element = this._container;
		let x=0, y=0;		
		while(element != null) {
		    x += element.offsetLeft;
		    y += element.offsetTop;
		    element = element.offsetParent;
		}
		return {x:x,y:y};
	}

    /**
     * Converts a point from the global coordinate system to that of the view's container.
	 * @param {Point} pos A point specified in the global coordinate sytem.
	 * @returns {Point} A point specified in the container coordinate system of this view.
     */
	globalToContainer(pos) {
		let containerOffset = this._getContainerOffset();
		return {
			x:pos.x - containerOffset.x,
			y:pos.y - containerOffset.y
		};
	}

	/**
     * Converts a point from the global coordinate system to that of the content.
	 * @param {Point} pos A point specified in the global coordinate sytem.
	 * @returns {Point} A point specified in the content coordinate system.
	 */
	globalToContent(pos) {
		pos = this.globalToContainer(pos);
		let contentAdjust = this._calcContentAdjust(this._zoomScale);
		return {
			x: (pos.x + this._contentOffset.x - contentAdjust.x) / this._zoomScale,
			y: (pos.y + this._contentOffset.y - contentAdjust.y) / this._zoomScale
		};
	}

	_handleSingleTap(evt) {		
		if(this._gestureDelegate.handleSingleTap != null) {
			if(this._gestureDelegate.handleSingleTap(evt)) {
				return;
			}
		}
	}

	_handleDoubleTap(evt) {

		if(this._gestureDelegate.handleDoubleTap != null) {
			if(this._gestureDelegate.handleDoubleTap(evt)) {
				return;
			}
		}

		if(this._lock) return;

		if(this._zoomScale != 1.0) {
			this.setContentOffsetAndZoomScale({x:0,y:0},1.0,true);
		} else {
			let pos = this.globalToContent(evt.center);
			this.zoomToPoint(pos,4.0,true);
		}
	}

	_getMinimumContentOffset(scale) {
		return {x:0,y:0};
	}

	_getMaximumContentOffset(scale) {
		let size = this._calcContentSize(scale || this._zoomScale);
		let adjust = this._calcContentAdjust(scale || this._zoomScale);
		return {
			x:Math.max(0, size.width - this._containerWidth + adjust.x),
			y:Math.max(0, size.height - this._containerHeight + adjust.y)
		};
	}

	_limitContentOffset(offset, bounce, scale) {
		scale = scale || this._zoomScale;
		let min = this._getMinimumContentOffset(scale);
		let max = this._getMaximumContentOffset(scale);

		let size = this._calcContentSize(scale);

		let bounceX, bounceY;
		if(bounce) {
			if(this._scrollBounce == 'auto') {
				bounceX = this._containerWidth < size.width;
				bounceY = this._containerHeight < size.height;
			} else {
				bounceX = bounceY = this._scrollBounce != 'off';
			}
		} else {
			bounceX = bounceY = false;
		}

		let x,y;
		if(bounceX) {
			x = _limitSpring(min.x, offset.x, max.x, 4/scale);
		} else {
			x = Math.min(Math.max(offset.x,min.x),max.x);
		}
		if(bounceY) {
			y = _limitSpring(min.y, offset.y, max.y, 4/scale);
		} else {
			y = Math.min(Math.max(offset.y,min.y),max.y);
		}
		return {x:x,y:y};
	}

	_handlePan(evt) {
		if(this._gestureDelegate.handlePan != null) {
			if(this._gestureDelegate.handlePan(evt)) {
				return;
			}
		}

		if(this._lock || this._pinchStartZoomScale) return;


		if(evt.type == "panstart") {			
			this._panStartOffset = {
				x:this._contentOffset.x, 
				y:this._contentOffset.y
			};
		} else if(evt.type == 'panmove') {
			let offset = this._limitContentOffset({
				x:this._panStartOffset.x - evt.deltaX,
				y:this._panStartOffset.y - evt.deltaY
			}, true);
			this._contentOffset.x = offset.x;
			this._contentOffset.y = offset.y;
			this.layout();
		} else if(evt.type == 'panend' || evt.type == 'pancancel') {
			
			this._panStartOffset = null;

			let min = this._getMinimumContentOffset();
			let max = this._getMaximumContentOffset();
			
			if (this._contentOffset.x < min.x || max.x < this._contentOffset.x ||
			   this._contentOffset.y < min.y || max.y < this._contentOffset.y) {
				this.setContentOffset({
					x:Math.min(Math.max(this._contentOffset.x,min.x),max.x),
					y:Math.min(Math.max(this._contentOffset.y,min.y),max.y),

				}, true);
			}

		}

	}

	_limitZoomScale(scale, spring) {
		if(spring) {
			return _limitSpring(this._minimumZoomScale, scale, this._maximumZoomScale, 4);
		} else {
			return Math.min(Math.max(this._minimumZoomScale, scale), this._maximumZoomScale);
		}
	}

	_handleMouseWheel(evt) {
		let center = this.globalToContent({x:evt.pageX,y:evt.pageY});
		if(evt.deltaY < 0) {
			this.zoomToPoint(center, this._limitZoomScale(this._zoomScale * this._wheelZoomScale), false);
		} else if(0 < evt.deltaY) {
			this.zoomToPoint(center, this._limitZoomScale(this._zoomScale / this._wheelZoomScale), false);
		}
	}

	_handlePinch(evt) {
		if(this._gestureDelegate.handlePinch != null) {
			if(this._gestureDelegate.handlePinch(evt)) {
				return;
			}
		}

		if(this._lock) return;

		if(evt.type == "pinchstart") {
			this._pinchStartZoomScale = this._zoomScale;
		} else if(evt.type == 'pinchmove') {
			let scale = this._limitZoomScale(this._pinchStartZoomScale * evt.scale, true);
			this._lastPinchCenter = this.globalToContent(evt.center);
			this.zoomToPoint(this._lastPinchCenter, scale);
		} else if(evt.type == 'pinchend' || evt.type == 'pinchcancel') {
			if(this._zoomScale < this._minimumZoomScale) {
				this.setContentOffsetAndZoomScale({x:0,y:0}, this._minimumZoomScale, true);
			} else if(this._maximumZoomScale < this._zoomScale) {
				this.zoomToPoint(this._lastPinchCenter, this._maximumZoomScale , true);
			}
			this._pinchStartZoomScale = null;
		}
	}

	/**
	 * Zooms to a specific point of the content.
	 * @param {Point} pos A target point of the zoom. The point should be specified in the content's coordinate system.
	 * @param {number} scale A floating-point value that specifies the new scale factor.
	 * @param {boolean} animated true to animate the transition, false to make it immediate.
	 */
	zoomToPoint(pos, scale, animated) {
		let contentAdjust = this._calcContentAdjust(this._zoomScale);

		let currentRect = {
			x: (this._contentOffset.x - contentAdjust.x) / this._zoomScale,
			y: (this._contentOffset.y - contentAdjust.y) / this._zoomScale,
			width: this._containerWidth / this._zoomScale,
			height: this._containerHeight / this._zoomScale
		};

		let a = this._zoomScale / scale;
		let rx = pos.x - currentRect.x,
			ry = pos.y - currentRect.y;
		let rect = {
			x: pos.x - rx * a,
			y: pos.y - ry * a,
			width: currentRect.width * a,
			height: currentRect.height * a
		};

		this.zoomTo(rect, true, animated);
	}


	/**
	 * Zooms to a specific area of the content so that it is visible in this view.
	 * @param {Rectangle} rect A rectangle defining an area of the content. 
	 *                         The rectangle should be in the coordinate space of the content.
	 * @param {boolean} limitOffset true to limit the content offset, false to not limit it.
	 * @param {boolean} animated true to animate the transition, false to make it immediate.
	 */
	zoomTo(rect, limitOffset, animated) {

		let scaleX = this._containerWidth / rect.width;
		let scaleY = this._containerHeight / rect.height;
		let newScale = Math.min(scaleX, scaleY);
		let newOffset = {
			x:rect.x * newScale,
			y:rect.y * newScale
		};
		if(limitOffset) {
			newOffset = this._limitContentOffset(newOffset, false, newScale);
		}
		this.setContentOffsetAndZoomScale(newOffset, newScale, animated);
	}


	lock(flag) {
		this._lock = flag;
	}


}

export default JScrollView;