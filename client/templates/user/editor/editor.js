var CANVAS_WIDTH = 'editorCanvasWidth';
var CANVAS_HEIGHT = 'editorCanvasHeight';
var MODE = 'editorMode';
var LAYOUT = 'editorLayout';
var DRAWING = 'editorDrawing';
var CURRENT_COLOR = 'editorCurrentColor';
var SHOW_PEN = 'editorShowPen';
var SELECTED_SHAPE = 'editorSelectedShape';
var DRAGGING_SHAPE = 'editorDraggingShape';
var UNDO = 'editorUndo';
var ORIENTATION = 'editorOrientation';
var HOVERED_LOOK = 'editorHoveredLook';
var SELECTED_LOOK = 'editorSelectedLook';
var SELECTED_IMAGE = 'editorSelectedImage';
var DRAWING_IMAGE_SELECTION = 'editorDrawingImageSelection';
var IMAGE_SELECTION = 'editorImageSelection';
var IMAGE_SELECTION_MOUSEDOWN = 'editorImageSelectionMousedown';
var modes = {};

_.each([
	'PICKING_TOOL',
	'PICKING_COLOR',
	'DRAWING_COLOR',
	'PICKING_LOOK',
	'PICKING_IMAGE'
], function(mode, i){ modes[mode] = mode });

var dpr = window.devicePixelRatio || 1;

var pen;
var canvasContainer, canvas, ctx;

var selectCanvas, selectCtx;

function draw(shapes){
			
	ctx.clearRect( 0, 0, canvas.width, canvas.height );
		
	var shape, i, j;
	
	for( i = shapes.length - 1; i >= 0; --i ){
		
		drawShape(shapes[i], canvas, ctx, {callback: function(){draw(shapes)}});

	}
	
	var selectedShape = Session.get(SELECTED_SHAPE);
	
	if(selectedShape !== false){
		drawShape(shapes[selectedShape], canvas, ctx, {selected: true});
		
	}
	
}

function drawSelection(){
	
	selectCtx.clearRect(0,0,canvas.width, canvas.height);
	
	var selection = Session.get(IMAGE_SELECTION);
	
	if(!selection) return;

	selectCtx.fillStyle = 'rgba(156,156,147,0.5)';
	selectCtx.fillRect(0,0, selectCanvas.width, selectCanvas.height);
	selectCtx.globalCompositeOperation = 'destination-out';
	drawShape(selection, selectCanvas, selectCtx);
	selectCtx.globalCompositeOperation = 'source-over';
	drawShape(selection, selectCanvas, selectCtx, {selected: true});
	
}

function getColorsAndLooks(universe){
		
	var colors = {};
	var looks = {};
	
	_.each(universe.shapes, function(shape){
		if(shape.color){
			var color = Colors.findOne({color: shape.color})._id;
			if(!colors[color]){
				colors[color] = 1;
			} else {
				colors[color]++;
			}
		} else if(shape.image) {
			var look = LookImages.findOne(shape.image).owner;
			if(!looks[look]){
				looks[look] = 1;
			} else {
				looks[look]++;
			}
		}
	});
	
	universe.colors = colors;
	universe.looks = looks;
	
}

var MIN_DIMENSION = 0.05;

function bigEnough(shape){
		
	return shape.bounds.width > MIN_DIMENSION || shape.bounds.height > MIN_DIMENSION;
	
}

function precision3(number){
	return Math.floor(number * 1000) / 1000;
}

function simplify(shape){
	var i = shape.points.length - 1;
	
	var thisX, thisY, nextX, nextY;
	
	function dist(fromX, fromY, toX, toY){
		return Math.sqrt(Math.pow(fromX - toX, 2) + Math.pow(fromY - toY, 2));
	}
	
	shape.points = _.map(shape.points, precision3);
	
	while(i > 2){
		
		thisX = shape.points[i - 1];
		thisY = shape.points[i];
		
		nextX = shape.points[i - 3];
		nextY = shape.points[i - 2];
		
		if(dist(thisX, thisY, nextX, nextY) <= 0.01){
			shape.points.splice(i-3, 2);
		}
		
		i -= 2;
		
	}
}

function findShape(shapes, x, y, lazy){
		
	var xmin, ymin, xmax, ymax;
	
	var idx = -1;
	
	var found = _.some(shapes, function(shape){
		
		idx++;
		
		//Bounding box test
		
		xmin = Infinity;
		ymin = Infinity;
		xmax = -Infinity;
		ymax = -Infinity;
		
		for(var i = 0; i < shape.points.length; i += 2){
			
			xmin = Math.min(xmin, shape.points[i]);
			xmax = Math.max(xmax, shape.points[i]);
			ymin = Math.min(ymin, shape.points[i+1]);
			ymax = Math.max(ymax, shape.points[i+1]);
			
		}
		
		if( x > xmin && x < xmax && y > ymin && y < ymax ){
			
			if(lazy) return true;
								
			//Hit test (W. Randolph Franklin)
			
			var j = shape.points.length - 2;
			var inside = false;
			
			for( i = 0; i <= shape.points.length; i += 2 ){
				
				if(
					( shape.points[i + 1] > y !== shape.points[j + 1] > y ) &&
					x < ( shape.points[j] - shape.points[i] ) * ( y - shape.points[i + 1] ) / ( shape.points[j + 1] - shape.points[i + 1]) + shape.points[i]
				) {
					inside = !inside;
				}
			
				j = i;
				
			}
			
			return inside;
			
		} else {
			
			return false;
			
		};
		
	});
	
	return found ? idx : false;
	
}

function getBounds(shape){
		
	var maxX = -Infinity;
	var maxY = -Infinity;
	var minX = Infinity;
	var minY = Infinity;
	
	for( var i = 0; i < shape.points.length; i += 2){
		
		maxX = Math.max(maxX, shape.points[i]);
		minX = Math.min(minX, shape.points[i]);
		maxY = Math.max(maxY, shape.points[i+1]);
		minY = Math.min(minY, shape.points[i+1]);
		
	}
	
	shape.center = {
		x: minX + (maxX-minX)/2,
		y: minY + (maxY-minY)/2
	};
	
	shape.bounds = {
		top: minY,
		left: minX,
		bottom: maxY,
		right: maxX,
		width: maxX - minX,
		height: maxY - minY
	}
	
	return shape;
	
}

function moveShape(shape, x, y){
	
	for(var i = 0; i < shape.points.length; i += 2){
		
		shape.points[i] += x;
		shape.points[i+1] += y;
		
	}
	
	shape.center.x += x;
	shape.center.y += y;
	
	shape.bounds.left += x;
	shape.bounds.top += y;
	shape.bounds.right += x;
	shape.bounds.bottom += y;

	return shape;
	
}

// Layout helpers

var MAX_SIDE_COLUMN_SIZE = 200;

function makeCSSTransform(x, y, scale){
	var ret = Modernizr.prefixed('transform') + ': translate3d(' + x + 'px, ' + y + 'px, 0)';
	if(scale) ret +=  ' scale(' + scale + ')';
	return ret + ';';
}

function makeCSS(x, y, w, h, font, scale){
	
	var ret = '';
	
	ret += 'width: ' + w + 'px; ';
	ret += 'height: ' + h + 'px; ';
	ret += 'font-size: ' + font + 'em; ';
	ret += makeCSSTransform(x, y, scale);
	
	return ret;
	
}

var hiddenStyle = ' opacity: 0; pointer-events: none; z-index: 0;';

function makeSizes(){
		
	if( window.innerWidth > window.innerHeight ){
		
		Session.set(ORIENTATION, 'landscape');
		
		var headerFooterHeight = 58;
		var gutters = 20;
		
		var primaryHeight = window.innerHeight - headerFooterHeight - headerFooterHeight;
		var primaryWidth = primaryHeight * CANVAS_RATIO;
		var primaryLeft = (window.innerWidth / 2) - (primaryWidth / 2);
		var primaryTop = headerFooterHeight;
	
		var secondaryWidth = Math.min( ((window.innerWidth - primaryWidth) / 2) - gutters * 2, MAX_SIDE_COLUMN_SIZE );
		var secondaryHeight = secondaryWidth / CANVAS_RATIO;
		var secondaryLeft = (primaryLeft / 2) - (secondaryWidth / 2);
		var secondaryTop = primaryTop + (primaryHeight - secondaryHeight) / 2;
		var secondaryScale = secondaryWidth / primaryWidth;
			
		var leftLeft = secondaryLeft;
		var leftTop = secondaryTop;
		var leftWidth = secondaryWidth;
		var leftHeight = secondaryHeight;
		var leftScale = secondaryScale;
		
		var rightTop = leftTop;
		var rightLeft = window.innerWidth - secondaryLeft - secondaryWidth;
		var rightWidth = leftWidth;
		var rightHeight = leftHeight;
		var rightScale = secondaryScale;
		
	} else {
		
		Session.set(ORIENTATION, 'portrait');
		
		var headerFooterHeight = 40;
		var gutters = 10;
		
		var secondaryTop = (window.innerHeight * 0.8) + gutters;
		var secondaryHeight = window.innerHeight - secondaryTop - headerFooterHeight;
		var secondaryWidth = secondaryHeight * CANVAS_RATIO;
		var secondaryLeft = (window.innerWidth - secondaryWidth) / 2;
		
		var primaryTop = headerFooterHeight;
		var primaryHeight = secondaryTop - gutters - headerFooterHeight;
		var primaryWidth = primaryHeight * CANVAS_RATIO;
		var primaryLeft = (window.innerWidth - primaryWidth) / 2;
		
		var secondaryScale = secondaryHeight / primaryHeight;
		
		var leftLeft = (((window.innerWidth - gutters*2) / 2) - secondaryWidth) / 2;
		var leftTop = secondaryTop;
		var leftHeight = secondaryHeight;
		var leftWidth = secondaryWidth/2 - gutters/2;
		
		var rightLeft = window.innerWidth - secondaryWidth - leftLeft;
		var rightTop = leftTop;
		var rightHeight = leftHeight;
		var rightWidth = leftWidth;
		
		var leftScale = secondaryScale;
		var rightScale = secondaryScale;
		
	}
	
	return {
		size: {
			w: primaryWidth,
			h: primaryHeight,
			font: 1 / (secondaryWidth / primaryWidth)
		},
		primary: {
			x: primaryLeft,
			y: primaryTop,
			scale: 1
		},
		secondary: {
			x: secondaryLeft, 
			y: secondaryTop, 
			scale: secondaryScale
		},
		left: {
			x: leftLeft,
			y: leftTop,
			scale: leftScale
		},
		right: {
			x: rightLeft,
			y: rightTop,
			scale: rightScale
		}
	}
	
}

function getCSS(region, hidden){
	
	var layout = Session.get(LAYOUT);
	var box = layout[region];
	var size = layout.size;
	
	var css = makeCSS(box.x, box.y, size.w, size.h, size.font, box.scale);
	
	if(hidden) css += hiddenStyle;
	if(region !== 'primary') css += 'cursor: pointer;';
	
	return css;
	
}

function scaleShape(shape, scale){
	
	var shapeCx = shape.center.x;
	var shapeCy = shape.center.y;
	
	function scalePoint(x, y, cx, cy){
		
		var d, a;
		
		var cx = cx === undefined ? shapeCx : cx;
		var cy = cy === undefined ? shapeCy : cy;
				
		x -= cx;
		y -= cy;
		
		d = Math.sqrt( x*x + y*y );
		
		a = Math.atan2(y, x);
		
		return[
			(Math.cos(a) * d * scale) + cx,
			(Math.sin(a) * d * scale) + cy
		]
		
	}

	var pt;
	
	for(var i = 0; i < shape.points.length; i += 2){
		
		pt = scalePoint(shape.points[i], shape.points[i+1]);
		
		shape.points[i] = pt[0];
		shape.points[i+1] = pt[1];
				
	}
	
	pt = scalePoint(shape.bounds.left, shape.bounds.top);
	shape.bounds.left = pt[0];
	shape.bounds.top = pt[1];
	
	pt = scalePoint(shape.bounds.right, shape.bounds.bottom);
	shape.bounds.right = pt[0];
	shape.bounds.bottom = pt[1];
	
	shape.bounds.width *= scale;
	shape.bounds.height *= scale;
	
	if(shape.image){
		pt = scalePoint(shape.offset.x, shape.offset.y, 0, 0);
		shape.offset.x = pt[0];
		shape.offset.y = pt[1];
		shape.scale *= scale;
	}
	
}

var colorWheelData;

(function(){
	var img = new Image();
	img.onload = function(){
		var canvas = document.createElement('canvas');
		var ctx = canvas.getContext('2d');
		canvas.width = 500,
		canvas.height = 500;
		ctx.drawImage(img, 0, 0);
		colorWheelData = ctx.getImageData(0,0,canvas.width, canvas.height).data;
	}
	img.src = '/img/colorWheel.jpg';
})();

function pushUndo(shapes){
	var undos = Session.get(UNDO);
	undos.push(deepClone(shapes));
	Session.set(UNDO, undos);
}

Template.editor.onCreated(function(){
	
	Session.set(MODE, modes.PICKING_TOOL);
	Session.set(SHOW_PEN, false);
	Session.set(DRAWING, false);
	Session.set(CURRENT_COLOR, '#000000');
	Session.set(LAYOUT, makeSizes());
	Session.set(SELECTED_SHAPE, false);
	Session.set(DRAGGING_SHAPE, false);
	Session.set(UNDO, [[]]);
	Session.set(HOVERED_LOOK, false);
	Session.set(SELECTED_LOOK, false);
	Session.set(SELECTED_IMAGE, false);
	Session.set(DRAWING_IMAGE_SELECTION, false);
	Session.set(IMAGE_SELECTION, false);
		
});

Template.editor.onRendered(function(){
		
	pen = this.$('.editor-pen');
	canvasContainer = this.$('.editor-canvas');
	var width = canvasContainer.width();
	var height = width * 1.41;
	canvas = this.$('#draw-canvas')[0];
	canvas.width = width * dpr;
	canvas.height = height * dpr;
	ctx = canvas.getContext('2d');
	draw(this.data.universe.shapes);
	
	selectCanvas = this.$('#select-canvas')[0];
	selectCtx = selectCanvas.getContext('2d');
	selectCanvas.width = width;
	selectCanvas.height = height;

	var self = this;
	var canvasSizer = $('#sizer');
	
	$(window).on('resize.editorCanvas', function(){
		var layout = makeSizes();
		canvas.height = selectCanvas.height = layout.size.h * dpr;
		canvas.width = selectCanvas.width = layout.size.w * dpr;
		draw(self.data.universe.shapes);
		drawSelection();
		Session.set(LAYOUT, layout);
	});
	
});

Template.editor.onDestroyed(function(){
	$(window).off('resize.editorCanvas');
})

Template.editor.helpers({
	
	'mode': function(is){
		return Session.get(MODE) === is;
	},
	
	'colors': function(){
		return Colors.find().map(function(color){
			color.bright = tinycolor(color.color).isLight();
			return color;
		});
	},
	
	'colorUsed': function(context){
		var times = context.universe.colors[this._id];
		if(times) return '&times;' + times;
	},
	
	'helpText': function(){
		
		switch( Session.get(MODE) ){
			
			case modes.PICKING_TOOL:
			
				if(this.universe.shapes.length){
										
					var settings = globalSettings();
					
					var moreColors = Math.max( settings.minColors - this.universe.colors.length, 0 );
					var moreLooks = Math.max( settings.minLooks - this.universe.looks.length, 0 );
					
					if(moreColors || moreLooks){
						
						var ret = 'Looking good! You just need to add ';
						
						if(moreColors) ret += numberAsWords(moreColors) + ' more ' + plural(moreColors, 'colour');
						if(moreColors && moreLooks) ret += ' and ';
						if(moreLooks) ret += numberAsWords(moreLooks) + ' more ' + plural(moreLooks, 'look');
						
						ret += '.'
						
						return ret;
						
					} else {
						
						return "Add more colours and looks, or click Finished.";
						
					}
					
				} else {
					return 'Add a colour or a look to get started.';
				}
							
			case modes.PICKING_COLOR:
				
				if(!_.keys(this.universe.colors).length){
					return "What's your favourite colour?";
				} else {
					return 'Pick another colour.';
				}
				
			case modes.DRAWING_COLOR:
				return 'Paint with your colour.';
				
			case modes.PICKING_LOOK:
			
				if(!_.keys(this.universe.looks).length){
					return "What's your favourite look?";
				} else {
					return 'Pick another look.';
				}
				
			case modes.PICKING_IMAGE:
				return "Pick something you like, or draw around an area.";
			
		}
		
	},
	
	'canUndo': function(){
		return Session.get(UNDO).length > 1;
	},
	
	'canvasStyle': function(){
				
		switch( Session.get(MODE) ){
			
			case modes.PICKING_TOOL:
				return getCSS('primary');
				
			case modes.PICKING_COLOR:
			case modes.PICKING_LOOK:
				return getCSS('secondary');
				
			case modes.DRAWING_COLOR:
				return getCSS('primary');
				
			case modes.PICKING_IMAGE:
				return getCSS('primary', true);
				
			default:
				return getCSS('secondary', true);
			
		}
	
	},
	
	'colorButtonStyle': function(){
		
		switch( Session.get(MODE) ){
			
			case modes.PICKING_TOOL:
				return getCSS('left');
				
			case modes.PICKING_COLOR:
				return getCSS('primary', true);
				
			case modes.DRAWING_COLOR:
				return getCSS('secondary', true);
				
			default:
				return getCSS('left', true);
			
		}
		
	},
	
	'lookButtonStyle': function(){
		
		switch( Session.get(MODE) ){
			
			case modes.PICKING_LOOK:
				return getCSS('primary', true);
			
			case modes.PICKING_TOOL:
				return getCSS('right')
				
			case modes.PICKING_STYLE:
				return getCSS('primary', true);
				
			default:
				return getCSS('right', true);
			
		}
		
	},
	
	'doneButtonStyle': function(){
		
		switch( Session.get(MODE) ){
			
			case modes.DRAWING_COLOR:
				return getCSS('right');
				
			default:
				return getCSS('right', true);
			
		}
		
	},
	
	'colorWheelStyle': function(){
		
		switch( Session.get(MODE) ){
			
			case modes.PICKING_COLOR:
				return getCSS('primary');
				
			case modes.DRAWING_COLOR:
				return getCSS('secondary');
				
			case modes.PICKING_TOOL:
				return getCSS('left', true);
				
			default:
				return getCSS('secondary', true);
			
		}
	
	},
	
	'lookPickerStyle': function(){
		
		switch( Session.get(MODE) ){
			
			case modes.PICKING_LOOK:
				return getCSS('primary');
				
			case modes.PICKING_IMAGE:
				return getCSS('left', Session.equals(ORIENTATION, 'portrait'));
				
			case modes.PICKING_TOOL:
				return getCSS('right', true);
				
			default:
				return getCSS('left', true);
			
		}
		
	},
	
	'lookNameStyle': function(){
		
		if( Session.equals(ORIENTATION, 'portrait') ) return getCSS('right', true);
		
		switch( Session.get(MODE) ){
			
			case modes.PICKING_LOOK:
				return getCSS('right');
								
			default:
				return getCSS('right', true);
			
		}
		
	},
	
	'hoveredLook': function(){
		return Session.get(HOVERED_LOOK);
	},
	
	'selectedImageStyle': function(){
		
		if(Session.get(MODE) === modes.PICKING_IMAGE){
			return getCSS('primary');
		} else {
			return getCSS('primary', true);
		}
		
	},
	
	'selectedImage': function(){
		var img = Session.get(SELECTED_IMAGE);
		if(!img) return false;
		return img.url;
	},
	
	'selectedImageClass': function(){
		return Session.get(SELECTED_IMAGE)._id === this._id && 'selected';
	},
	
	'selectedImageTranslate': function(){

		var lookId = Session.get(SELECTED_LOOK);
		var imgId = Session.get(SELECTED_IMAGE)._id;
		if(!lookId || !imgId) return 0;
		var imgs = LookImages.find({owner: lookId});
		var length = imgs.count();
		imgs = imgs.fetch();
		for(var i = 0; i < imgs.length; ++i){
			if(imgs[i]._id === imgId) break;
		}
		if( Session.equals(ORIENTATION, 'landscape') ) {
			var pct = -100 * (i / length);
			return Modernizr.prefixed('transform') + ': translateY(' + pct + '%)';
		} else {
			var pct = -105 * (i + 1);
			return Modernizr.prefixed('transform') + ': translateX(' + pct + '%)';
		}
	},

	'imageListStyle': function(){
		
		var pos = Session.equals(ORIENTATION, 'portrait') ? 'secondary' : 'right';
		
		return getCSS(pos, !Session.equals(MODE, modes.PICKING_IMAGE));
		
	},
	
	'imageList': function(){
		var lookId = Session.get(SELECTED_LOOK);
		if(!lookId) return false;
		return LookImages.find({owner: lookId})
	},
	
	'scaledScreenHeight': function(){
		return window.innerHeight / Session.get(LAYOUT).secondary.scale;
	},

	'shapeControlsStyle': function(){
				
		var selectedShape = Session.get(DRAGGING_SHAPE);
		
		if( selectedShape === false ) {
			selectedShape = Session.get(SELECTED_SHAPE);
		} else {
			selectedShape = selectedShape.shape;
		}
		
		if( selectedShape === false ) return hiddenStyle;
		
		var shape = this.universe.shapes[ selectedShape ];
		
		var cx = shape.center.x;
		var cy = shape.center.y;
				
		var layout = Session.get(LAYOUT);
		
		cx *= layout.size.w;
		cy *= layout.size.h;
		
		cx = Math.min( layout.size.w, Math.max( cx, 0 ) );
		cy = Math.min( layout.size.h, Math.max( cy, 0 ) );
		
		return makeCSSTransform(cx, cy);
		
	},
	
	'looks': function(){
		return Looks.find({});
	},
	
	'lookUsed': function(context){
		var times = context.universe.looks[this._id];
		if(times) return '&times;' + times;
	},
	
	'lookPreview': function(){
		var img = LookImages.findOne({owner: this._id});
		return img.url;
	}	
		
});

function showPen(){
	
	if(Modernizr.touch) return;
	
	Session.set(SHOW_PEN, true);
	
	$(window).on('mousemove.pen', function(e){
		pen.css({
			top: e.clientY,
			left: e.clientX
		})
	})
	
}

function hidePen(){
	
	if(Modernizr.touch) return;
	
	Session.set(SHOW_PEN, false);
	
	$(window).off('mousemove.pen');
	
}

Template.editor.events({
	
	'click .colors-button': function(){
		
		Session.set(SELECTED_SHAPE, false);
		Session.set( MODE, modes.PICKING_COLOR );
		
	},
	
	'click .looks-button': function(){
		
		Session.set(SELECTED_SHAPE, false);
		Session.set( MODE, modes.PICKING_LOOK );
		
	},
	
	'click .done-button': function(){
		
		hidePen();
		
		switch( Session.get( MODE ) ){
			
			case modes.DRAWING_COLOR:
				Session.set(MODE, modes.PICKING_TOOL);
			
		}
		
	},
	
	/*
	
	'mouseenter .color-wheel': function(){
		
		if( Session.get(MODE) === modes.PICKING_COLOR ) showPen();
		
	},
	
	'mouseleave .color-wheel': function(){
		
		hidePen();
		
	},
	
	'mousemove .color-wheel': function(event){
		
		if( Session.get(MODE) !== modes.PICKING_COLOR ) return;
				
		var size = $(event.target).width();
		var x = Math.floor( (event.offsetX / size) * 500 );
		var y = Math.floor( (event.offsetY / size) * 500 );
		
		var rIndex = x * 4 + y * 500 * 4;
	
		var color = 'rgb(' + colorWheelData[rIndex] + ', ' + colorWheelData[rIndex + 1] + ', ' + colorWheelData[rIndex + 2] + ')';
		
		Session.set(CURRENT_COLOR, color);
		
		pen.css({
			top: event.clientY,
			left: event.clientX,
			background: color
		});
		
	},
	
	'click .color-wheel': function(event){
		
		Session.set(DRAWING, false);
				
		switch( Session.get(MODE) ){
			
			case modes.PICKING_COLOR:
				Session.set(MODE, modes.DRAWING_COLOR);
				break;
				
			case modes.DRAWING_COLOR:
				Session.set(MODE, modes.PICKING_COLOR);
				break;
			
		}
		
	},
	*/
	
	'click .swatches': function(){
		
		if( Session.equals(MODE, modes.DRAWING_COLOR) ){
			Session.set(MODE, modes.PICKING_COLOR);
		}
		
	},
	
	'click .swatches div': function(event){
		
		if( Session.equals(MODE, modes.PICKING_COLOR) ){
			
			event.stopPropagation();
			
			pen.css({
				background: this.color
			});
			
			Session.set(CURRENT_COLOR, this.color);
			Session.set(MODE, modes.DRAWING_COLOR);
			
		}
		
	},
	
	'mouseenter canvas': function(){
		
		if( Session.get(MODE) === modes.DRAWING_COLOR ) showPen();
		
	},
	
	'mouseleave .editor-canvas': function(){
		
		Session.set(SELECTED_SHAPE, false);
		hidePen();
		
	},
	
	'click #draw-canvas': function(){
		
		switch( Session.get(MODE) ){
			
			case modes.PICKING_COLOR:
			case modes.PICKING_LOOK:
				Session.set(MODE, modes.PICKING_TOOL);
				break;
			
		}
		
	},
	
	'mousedown #draw-canvas, touchstart #draw-canvas': function(event){
		
		var canvas = $(event.target);
		
		if(event.type === 'touchstart'){
			var offset = canvas.offset();
			var x = event.originalEvent.touches[0].pageX - offset.left;
			var y = event.originalEvent.touches[0].pageY - offset.top;
		} else {
			if( event.button !== undefined && event.button !== 0 ) return;
			var x = event.offsetX;
			var y = event.offsetY;
		}
		
		x /= canvas.width();
		y /= canvas.height();
						
		var mode = Session.get(MODE);
				
		if( mode === modes.DRAWING_COLOR ){
									
			Session.set(DRAWING, true);
			
			pushUndo(this.universe.shapes);
			
			this.universe.shapes.unshift({
				color: Session.get(CURRENT_COLOR),
				points: [x, y]
			})
			
			getColorsAndLooks(this.universe);
			
		} else if (mode === modes.PICKING_TOOL ){
			
			var selectedShape;
			
			if(true){
				
				selectedShape = findShape(this.universe.shapes, x, y);
				
				Session.set(SELECTED_SHAPE, selectedShape);
				
			} else {
				
				selectedShape = Session.get(SELECTED_SHAPE);
				
			}
			
			if( selectedShape !== false ) {
				
				pushUndo(this.universe.shapes);
				
				Session.set(DRAGGING_SHAPE, {
					shape: selectedShape,
					x: x,
					y: y
				});
				
			}
			
			draw(this.universe.shapes);
			
		}

	},
	
	'mouseup, touchend': function(){
				
		if(Session.get(DRAWING)){
			
			var shape = this.universe.shapes[0];
			
			getBounds(shape);
			
			if(!bigEnough(shape)) {
				shape.points = [0,0,0.2,0,0.2,0.2,0,0.2];
				getBounds(shape);
				draw(this.universe.shapes);
			}
			
			Session.set(DRAWING, false);
			
		}
				
		var selection = Session.get(IMAGE_SELECTION);
		
		if(selection){
			
			simplify(selection);
			
			//console.log('LookImages.update(LookImages.findOne({url:"' + Session.get(SELECTED_IMAGE).url + '"})._id,{$push:{regions:' + JSON.stringify(selection) + '}});');
			
			var shape = getBounds(selection);
			
			if(bigEnough(shape)){
								
				var image = Session.get(SELECTED_IMAGE);
				
				delete shape.color;
				shape.image = image._id;
				shape.scale = 1;
				var imgRatio = image.w / image.h;
				shape.offset = imgRatio > CANVAS_RATIO ? {x: 0,  y: (1-(CANVAS_RATIO/imgRatio))/2 } : {x: (CANVAS_RATIO - imgRatio) / 2, y: 0 };
				shape.offset.x = shape.bounds.left - shape.offset.x;
				shape.offset.y = shape.bounds.top - shape.offset.y;
				debugger;
				this.universe.shapes.unshift(shape);
				getColorsAndLooks(this.universe);
				Session.set(MODE, modes.PICKING_TOOL);
				
			}
			
			Session.set(IMAGE_SELECTION, false);
			Session.set(DRAWING_IMAGE_SELECTION, false);
			draw( this.universe.shapes );
			
		}
		
		Session.set(DRAGGING_SHAPE, false);
		Session.set(IMAGE_SELECTION_MOUSEDOWN, false)
		
	},
	
	'mousemove #draw-canvas, touchmove #draw-canvas': function(event){
		
		var canvas = $(event.target);
		
		if(event.type === 'touchmove'){
			event.preventDefault();
			var offset = canvas.offset();
			var x = event.originalEvent.touches[0].pageX - offset.left;
			var y = event.originalEvent.touches[0].pageY - offset.top;
		} else {
			if( event.button !== undefined && event.button !== 0 ) return;
			var x = event.offsetX;
			var y = event.offsetY;
		}
					
		x /= canvas.width();
		y /= canvas.height();
		
		if( Session.get(DRAWING) ){
			
			var points = this.universe.shapes[0].points;
			points.push( x, y );
			
		} else if( Session.get(MODE) === modes.PICKING_TOOL ){
			
			var draggingShape = Session.get(DRAGGING_SHAPE);
			
			if( draggingShape ){
				
				var shape = this.universe.shapes[ draggingShape.shape ];
				var deltaX = x - draggingShape.x;
				var deltaY = y - draggingShape.y;
								
				moveShape(shape, deltaX, deltaY);
				
				Session.set(DRAGGING_SHAPE, {
					shape: draggingShape.shape,
					x: draggingShape.x + deltaX,
					y: draggingShape.y + deltaY
				});
				
			} else if(event.type !== 'touchmove') {
								
				Session.set( SELECTED_SHAPE, findShape(this.universe.shapes, x, y, Session.get(SELECTED_SHAPE) !== false) );
				
			}
			
		}

		draw( this.universe.shapes );
		
	},
	
	'click .controls-delete': function(){
		
		var selectedShape = Session.get(SELECTED_SHAPE);
		
		if(selectedShape !== false){
			
			pushUndo(this.universe.shapes);
			
			this.universe.shapes.splice(selectedShape, 1);
			
			getColorsAndLooks(this.universe);
			
			Session.set(SELECTED_SHAPE, false);
			
			draw(this.universe.shapes);
			
		}
		
	},
	
	'click .controls-scaleup': function(){
		
		var selectedShape = Session.get(SELECTED_SHAPE);
		
		if(selectedShape !== false){
			
			pushUndo(this.universe.shapes);
			
			scaleShape( this.universe.shapes[ selectedShape ], 1.2);
			
			draw(this.universe.shapes);
			
		}
			
	},
	
	'click .controls-scaledown': function(){
		
		var selectedShape = Session.get(SELECTED_SHAPE);
		
		if(selectedShape !== false){
			
			pushUndo(this.universe.shapes);			
			
			scaleShape( this.universe.shapes[ selectedShape ], 0.8);
			
			draw(this.universe.shapes);
			
		}
			
	},
	
	'click #undo': function(){
		
		var undos = Session.get(UNDO);
		
		this.universe.shapes = undos.pop();
		
		Session.set(UNDO, undos);
		
		getColorsAndLooks(this.universe);
		
		draw(this.universe.shapes);
		
	},
	
	'click #finished': function(){
						
		_.each( this.universe.shapes, function(shape){
			
			shape.points = _.map(shape.points, function(pt){ return precision3(pt) });
			
			_.each(['bounds', 'center', 'offset'], function(key){
				
				var obj = shape[key];
				
				if(obj){
					
					_.each(obj, function(value, key){
						
						obj[key] = precision3(value);
						
					});
					
				}
				
			});
			
		});
		
		console.log(JSON.stringify(this.universe));
		
		Meteor.call('saveUniverse', this._id, this.universe, function(error, result){
			
			if(error){
				alert(error.reason);
				return;
			}
			
			Router.go('/child/' + result);
			
		})
				
		//Children.update(this._id, {$set: {universe: this.universe}});
		
	},
	
	'click .look-picker': function(){
		
		if(Session.get(MODE) === modes.PICKING_IMAGE){
			Session.set(MODE, modes.PICKING_LOOK);
		}
		
	},
	
	'mouseenter .look-thumb': function(){
		
		Session.set(HOVERED_LOOK, this);
		
	},
	
	'mouseleave .look-thumb': function(){
		
		Session.set(HOVERED_LOOK, false);
		
	},
	
	'click .look-thumb': function(event){
		
		if(Session.get(MODE) === modes.PICKING_LOOK){
			Session.set(SELECTED_LOOK, this._id);
			Session.set(SELECTED_IMAGE, LookImages.findOne({owner: this._id}) );
			selectCtx.clearRect(0,0,selectCanvas.width, selectCanvas.height);
			Session.set(MODE, modes.PICKING_IMAGE);
			event.stopPropagation();
		}
		
	},
	
	'click .image-container.look-image': function(){
		
		Session.set(SELECTED_IMAGE, this);
		selectCtx.clearRect(0,0,selectCanvas.width, selectCanvas.height);
		
	},
	
	'click .image-container.back-button': function(){
		Session.set(MODE, modes.PICKING_LOOK);
	},
	
	'mousedown #select-canvas, touchstart #select-canvas': function(event){
				
		Session.set(IMAGE_SELECTION_MOUSEDOWN, true)
		
		/*
		
		if(!Session.get(IMAGE_SELECTION)){
			
			var canvas = $(event.target);
			
			if(Modernizr.touch){
				event.preventDefault();
				var offset = canvas.offset();
				var x = event.originalEvent.touches[0].pageX - offset.left;
				var y = event.originalEvent.touches[0].pageY - offset.top;
			} else {
				if( event.button !== undefined && event.button !== 0 ) return;
				var x = event.offsetX;
				var y = event.offsetY;
			}
			
			x /= canvas.width();
			y /= canvas.height();
						
			Session.set(DRAWING_IMAGE_SELECTION, true);
			Session.set(IMAGE_SELECTION, {
				color: '#000000',
				points: [x, y]
			});
						
		}
		
		*/
	
	},
	
	'mousemove #select-canvas, touchmove #select-canvas': function(event){
				
		var canvas = $(event.target);
		
		if(event.type === 'touchmove'){
			event.preventDefault();
			var offset = canvas.offset();
			var x = event.originalEvent.touches[0].pageX - offset.left;
			var y = event.originalEvent.touches[0].pageY - offset.top;
		} else {
			if( event.button !== undefined && event.button !== 0 ) return;
			var x = event.offsetX;
			var y = event.offsetY;
		}
		
		x /= canvas.width();
		y /= canvas.height();
								
		if( Session.get(IMAGE_SELECTION_MOUSEDOWN) ){
			
			if(Session.get(DRAWING_IMAGE_SELECTION)){
				
				var selection = Session.get(IMAGE_SELECTION);
				
				selection.points.push(x, y);
				
				Session.set(IMAGE_SELECTION, selection);
				
			} else {
				
				Session.set(DRAWING_IMAGE_SELECTION, true);
				Session.set(IMAGE_SELECTION, {
					color: '#000000',
					points: [x, y]
				});
				
			}
									
		} else {
			
			var image = Session.get(SELECTED_IMAGE);
			
			var selectedShape = findShape(image.regions, x, y);
			
			if(selectedShape !== false){
				Session.set(IMAGE_SELECTION, image.regions[selectedShape]);
			} else {
				Session.set(IMAGE_SELECTION, false);
			}
			
		}
		
		drawSelection();
		
	}
		
});