/*
    Marmelo base theme for Drupal
    Copyright (C) 2017  Marmelo Ltd
 
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. 

    */

/**
 * @file DecodeDrawer
 * Draws coloured squares onto the screen in random places at random intervals
 */


var DecodeDrawerOptions = {

    colors: ['#e4701e', '#33e986', '#fff16e', '#fff00ff', '#00b1b0', '#E37FD2']

};

function DecodeDrawer(canvasId, options) {

    if(!options) {
        options = {};
    }

    /*  MEMBER VARIABLES  */
    this.canvas = null;     // I know this isn't necessary, but I like to have my properties up top
    this.canvasContext = null;

    this.options = {
        timeBetweenPatterns: options.timeBetweenPatterns ? options.timeBetweenPatterns : 600,
        timeBetweenSquares: options.timeBetweenSquares ? options.timeBetweenSquares : 200,
        debugMode: options.debugMode ? options.debugMode : false,
        limitFrames: options.limitFrams ? options.limitFrames : 0,
        maxPatterns: options.maxPatterns ? options.maxPatterns : 10 
    };


    this.timers = {
        nextSquareTime: 0,
        nextPatternTime: 0
    };

    this.drawrects = options.drawrects ? options.drawrects : {x:0, y:0, w: 100, h:100};

    this.activePatterns = new Array();
    this.completePatterns = new Array();
    this.patternsForDeletion = new Array();

    this.activePatternCount = 0;

    this.lastRender = 0;
    this.thisRender = 0;
    this.called = 0;    

    this.lastDrawRect = null;

    // TODO: pass these from the theme


    /*  HELPER OBJECTS */
    this.Pattern = function(drawrect) {

        this.completeSquares = new Array();
        this.activeSquares = new Array();

        this.drawRect = drawrect ? drawrect : {

            x: 0,
            y: 0,
            w: 100,
            h: 100

        };

        this.outOfBounds = false;

        this.Square = function(x,y,color) {

            this.x = x;
            this.y = y;
            this.renderStep = 0;
            this.renderComplete = false;
            this.color = color;

            return this;
        }

        this.addSquare = function() {

            var x = 0;
            var y = 0;
            var color = DecodeDrawerOptions.colors[Math.floor(Math.random() * DecodeDrawerOptions.colors.length)];


            // determine x and y coordinates
            if(this.completeSquares.length) {

                var mostRecentSquare = this.completeSquares[this.completeSquares.length -1];

                // let's add this square to the existing ones

                // put the new one near the last one
                x = Math.random() > 0.1 ? mostRecentSquare.x + 10 : mostRecentSquare.x;
                y = Math.random() > 0.9 ? mostRecentSquare.y + 10 : mostRecentSquare.y;
                
                // 30% chance it just takes the last one's colour                
                if(Math.random() < 0.3) {
                    color = mostRecentSquare.color;
                }

            } else {

                // first square, so put it anywhere we like
                x = this.drawRect.x + (Math.round((Math.random() * (this.drawRect.w)) / 10) * 10);
                y = this.drawRect.y + (Math.round((Math.random() * (this.drawRect.h)) / 10) * 10);

            }

            // do a quick check to make sure this Square doesn't break bounds
            if(x > this.drawRect.x + this.drawRect.w || y > this.drawRect.y + this.drawRect.h) {

                this.outOfBounds = true;

            } else {

                this.activeSquares.push(new this.Square(x, y, color));

            }


        }

        this.markSquareComplete = function(index) {
            this.completeSquares.push(this.activeSquares[index]);
            this.activeSquares.splice(index, 1);
        }


        return this;

    };    


    /*  METHODS */

    /*  Get canvas once initialised; fail if canvas element not available  */
    if(canvasId) {

        this.canvas = document.getElementById(canvasId);

        if(this.canvas) {

            this.canvasContext = this.canvas.getContext("2d");

            if(!this.canvasContext) {
                return false;
            }

        } else {
            this._debug("No canvas element available with that ID");
            return false;
        }
        
    }

    /*  Apply functions and start timer */
    this.start = function() {

        this.scaleCanvas();

        // ask the browser to let us know when it's next ready to render
        window.requestAnimationFrame(this.render.bind(this));
        

    };

    this._debug = function(message) {

        if(this.options.debugMode) {
            console.log(message);
        }

    }


    /*  Renders based on current state each frame */
    this.render = function(timestamp) {

        this.called++;
        this._debug(this.called);
        this.thisRender = timestamp;

        if(timestamp > this.timers.nextPatternTime || this.activePatterns.length === 0) {

            // time to draw a new pattern                    
            var drawRectIndex = null;

            switch(this.drawrects.length) {

                case 1:
                    drawRectIndex = 0;
                    break;
                case 2:
                    drawRectIndex = this.lastDrawRect == 1 ? 0 : 1;
                    break;
                default:
                    // Don't draw in the same rect as last time if there's more than one available
                    // these are both initialised to null so the first time it will pass as soon as
                    // a valid integer has been found
                    while(drawRectIndex == null || drawRectIndex == this.lastDrawRect) {  
                        drawRectIndex = Math.floor(Math.random() * this.drawrects.length);
                    }
                    break;

            }


            this.activePatterns.push(new this.Pattern(this.drawrects[drawRectIndex]));
            this.timers.nextPatternTime = timestamp + this.options.timeBetweenPatterns;
            this.activePatternCount++;
            this.lastDrawRect = drawRectIndex;
            this._debug("New pattern");

        }

        this.updatePatterns();

        this.thisRender = 0;
        this.lastRender = timestamp;

        if(this.options.limitFrames == 0 || this.called < this.options.limitFrames) {
            window.requestAnimationFrame(this.render.bind(this));
        }

    };


    /*  Add squares to patterns or mark them ended */
    this.updatePatterns = function() {


        var markedForDeletion = new Array(); 

        // First of all, are there any active patterns?
        if(this.activePatternCount) {

            // there are?  Great
            for(var i = 0; i < this.activePatternCount; i++) {
                                            
                // add a square, if it's time
                if(this.thisRender > this.timers.nextSquareTime) {
                    //this._debug("Adding square");
                    this.activePatterns[i].addSquare();
                }

                try {
                    this.updateSquares(this.activePatterns[i]);                    
                }

                catch(e) {
                    console.log(this.activePatterns);
                    console.log(i);
                }


                // 0.1% chance of this pattern coming to an end
                if(this.activePatterns[i].activeSquares.length === 0 &&  (Math.random() < 0.028 || this.activePatterns[i].outOfBounds)) {
                    markedForDeletion.push(i);
                    //this._debug("Pattern is over!");
                }

            }


        }


        var markedForPermanentDeletion = new Array();
        // Paint over all the passages for deletion
        if(this.patternsForDeletion) {

            for(var k = 0; k < this.patternsForDeletion.length; k++) {
                                            
                // no more squares left, delete this pattern completely
                if(!this.patternsForDeletion[k].completeSquares.length) {
                    markedForPermanentDeletion.push(k);
                } else {
                    this.paintOverSquares(this.patternsForDeletion[k]);                                    
                }

            }

        }        

        // permanently remove patterns that are no longer needed
        if(markedForPermanentDeletion.length) {

            for(var l = markedForPermanentDeletion.length -1; l > -1; l--) {
                markedForPermanentDeletion.splice(l, 1);
            }

        }

        // remove any that have been marked for deletion
        // we have to do this separately to avoid messing up the array while we're in it
        if(markedForDeletion.length) {

            for(var j= markedForDeletion.length - 1; j > -1; j--) {

                this.completePatterns.push(this.activePatterns[markedForDeletion[j]]);                
                this.activePatterns.splice(markedForDeletion[j], 1);
                this.activePatternCount--;

            }

        }


        if(this.thisRender > this.timers.nextSquareTime) {
            this.timers.nextSquareTime = this.thisRender + this.options.timeBetweenSquares;       
        }

        // once we get to ten complete patterns, time to start deleting them
        if(this.completePatterns.length > this.options.maxPatterns) {

            // delete the last pattern
            this.patternsForDeletion.push(this.completePatterns[0]);
            this.completePatterns.splice(0,1);

        }

    };


    /*  Draw updated squares  */
    this.updateSquares = function(pattern) {

        // Do we have any squares that haven't finished rendering yet?

        var markComplete = new Array();

        // If so, draw the next step of their animation
        this._debug("Updated squares");
        if(pattern.activeSquares.length) {
            for(i = 0; i < pattern.activeSquares.length; i++) {
                
                switch(pattern.activeSquares[i].renderStep) {

                    case 0:
                        pattern.activeSquares[i].renderStep++;
                        this.drawSquare(pattern.activeSquares[i], 1);
                        break;

                    case 1:
                        pattern.activeSquares[i].renderStep++;
                        this.drawSquare(pattern.activeSquares[i], 2);
                        break;

                    case 2:
                        pattern.activeSquares[i].renderStep++;
                        this.drawSquare(pattern.activeSquares[i], 4);
                        break;

                    case 3:
                        pattern.activeSquares[i].renderStep++;
                        this.drawSquare(pattern.activeSquares[i], 6);
                        break;

                    case 4:
                        pattern.activeSquares[i].renderStep++;
                        this.drawSquare(pattern.activeSquares[i], 8);
                        break;

                    case 5:                    
                        this.drawSquare(pattern.activeSquares[i], 10);                    
                        markComplete.push(i);
                        break;

                }
                
            }
        }

        for(var j = markComplete.length -1; j > -1; j--) {
            
            pattern.markSquareComplete(markComplete[j]);                

        }
                        

    };

    this.paintOverSquares = function(pattern) {

            try {

                pattern.completeSquares[0].color = "#FFFFFF";

            }

            catch(e) {
                console.log(pattern.completeSquares);
            }


            switch(pattern.completeSquares[0].renderStep) {

                case 5:
                    pattern.completeSquares[0].renderStep--;
                    this.drawSquare(pattern.completeSquares[0], 1);
                    break;

                case 4:
                    pattern.completeSquares[0].renderStep--;
                    this.drawSquare(pattern.completeSquares[0], 2);
                    break;

                case 3:
                    pattern.completeSquares[0].renderStep--;
                    this.drawSquare(pattern.completeSquares[0], 4);
                    break;

                case 2:
                    pattern.completeSquares[0].renderStep--;
                    this.drawSquare(pattern.completeSquares[0], 6);
                    break;

                case 1:
                    pattern.completeSquares[0].renderStep--;
                    this.drawSquare(pattern.completeSquares[0], 8);
                    break;

                case 0:                    
                    pattern.completeSquares[0].renderStep--;
                    this.drawSquare(pattern.completeSquares[0], 10);
                    pattern.completeSquares.splice(0,1);
                    break;

            }

    }


    /*  Ensure canvas element painting area matches full screen 
        This is called on start, but can also be called on resize 
        as needed  */
    this.scaleCanvas = function() {
        this.canvas.width = document.body.clientWidth;
        this.canvas.height = document.body.clientHeight;                
    }



    /*  Draw a square based on current status */
    this.drawSquare = function(square, size) {

        if(size > 10) {

            // must be smaller than 10px wide
            return false;

        } else {

            if(square.color == "#FFFFFF") {

                this.canvasContext.clearRect(square.x, square.y, size, size);

            } else {
                var border = 10 - size;

                this.canvasContext.fillStyle = square.color;
                this.canvasContext.fillRect(square.x + border, square.y + border, size, size);
            }
            
        }

    };


    return this;

};
(function($) {

    $.fn.marmeloSlide = function(containerName, itemClass, minNumber) {
    

        console.log("Creating marmelo slider with container "+ containerName + " and " + itemClass);

        this.find(containerName).addClass('marmelo-slide-container');
        this.find(containerName + ">" + itemClass).addClass('marmelo-slide-item');

        // assign this slider a unique classname
        var date = new Date();
        var uniqueClass = "uq-" + date.getMilliseconds() + Math.round(Math.random() * 999999);
        var uniqueClassId = uniqueClass + "-item";
        this.addClass(uniqueClass).addClass('marmelo-slide-loaded');        
        this.find(containerName + " > " + itemClass).first().addClass('show');        

        minNumber = minNumber ? minNumber : 1;

        if(this.find(containerName + " > " + itemClass).length < (minNumber+1)) {
            console.log("Not enough to carouse");
            return this;
        }

        // add paging
        pag = $("<div class='pagination'></div>");
        i = 0;        
        
        this.find(containerName + " > " + itemClass).each(function() {

            $(this).addClass(uniqueClassId);

            thislink = $("<i data-link-to='" + i + "' data-parent-class='" + uniqueClass + "' class='paginate-link'></i>");
            thislink.on('click', function() {


                allItems = $("."+$(this).attr('data-parent-class')).find(containerName + " " + itemClass);                
                allItems.removeClass('show').addClass('past');
                refItem = $(allItems.get($(this).attr('data-link-to')));
                refItem.removeClass('past').addClass('show');
                $(this).addClass('show');
                
            });
            i++;
            
            pag.append(thislink);                
        });
        this.append(pag);        
    
        // add next/prev
        prev = $("<div class='previous'></div>");
        next = $("<div class='next'></div>");
        this.prepend(prev);
        this.append(next);
    
        // set behaviours
        prev.on('click', function() {
            
            var allItems = this.find(containerName + " > " + itemClass);

            // if fewer than minimum would be on screen, show all
            if(allItems.not('.past').length <= minNumber) {
                allItems.removeClass('past').removeClass('show');            
            } else {
                
                current = this.find(containerName + " > " + itemClass+".show");
                if(current.length < 1) {
                    current = allItems.first();
                }

                current.removeClass('show').addClass('past');
                var nextOne = current.prev();
                if(nextOne.length < 1) {
                    allItems.removeClass('past');
                    allItems.first().addClass('past');
                    nextOne = allItems.last(); 
                }
                nextOne.removeClass('past').addClass('show')
            }            

        }.bind(this));

        next.on('click', function(e, passed) {

            if(!passed) {
                // set up another movement
                $(this).data('paused', 'true');
            }

            if($(this).data('paused') && passed) {

            } else {
                var allItems = this.find(containerName + " > " + itemClass);

                // if fewer than minimum would be on screen, show all
                if(allItems.not('.past').length <= minNumber) {
                    allItems.removeClass('past').removeClass('show');            
                } else {
                    
                    current = this.find(containerName + " > " + itemClass+".show");
                    if(current.length < 1) {
                        current = allItems.first();
                    }
    
                    current.removeClass('show').addClass('past');
                    var nextOne = current.next();
                    if(nextOne.length < 1) {
                        allItems.removeClass('past');
                        nextOne = allItems.first(); 
                    }
                    nextOne.removeClass('past').addClass('show')
                }                
            }
            
 
        }.bind(this));
        

        return this;
    
    }
    
})(jQuery);
;
// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel

// MIT license

(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
 
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());;
/*!
 * @preserve
 *
 * Readmore.js jQuery plugin
 * Author: @jed_foster
 * Project home: http://jedfoster.github.io/Readmore.js
 * Licensed under the MIT license
 *
 * Debounce function from http://davidwalsh.name/javascript-debounce-function
 */
!function(t){"function"==typeof define&&define.amd?define(["jquery"],t):"object"==typeof exports?module.exports=t(require("jquery")):t(jQuery)}(function(t){"use strict";function e(t,e,i){var o;return function(){var n=this,a=arguments,s=function(){o=null,i||t.apply(n,a)},r=i&&!o;clearTimeout(o),o=setTimeout(s,e),r&&t.apply(n,a)}}function i(t){var e=++h;return String(null==t?"rmjs-":t)+e}function o(t){var e=t.clone().css({height:"auto",width:t.width(),maxHeight:"none",overflow:"hidden"}).insertAfter(t),i=e.outerHeight(),o=parseInt(e.css({maxHeight:""}).css("max-height").replace(/[^-\d\.]/g,""),10),n=t.data("defaultHeight");e.remove();var a=o||t.data("collapsedHeight")||n;t.data({expandedHeight:i,maxHeight:o,collapsedHeight:a}).css({maxHeight:"none"})}function n(t){if(!d[t.selector]){var e=" ";t.embedCSS&&""!==t.blockCSS&&(e+=t.selector+" + [data-readmore-toggle], "+t.selector+"[data-readmore]{"+t.blockCSS+"}"),e+=t.selector+"[data-readmore]{transition: height "+t.speed+"ms;overflow: hidden;}",function(t,e){var i=t.createElement("style");i.type="text/css",i.styleSheet?i.styleSheet.cssText=e:i.appendChild(t.createTextNode(e)),t.getElementsByTagName("head")[0].appendChild(i)}(document,e),d[t.selector]=!0}}function a(e,i){this.element=e,this.options=t.extend({},r,i),n(this.options),this._defaults=r,this._name=s,this.init(),window.addEventListener?(window.addEventListener("load",c),window.addEventListener("resize",c)):(window.attachEvent("load",c),window.attachEvent("resize",c))}var s="readmore",r={speed:100,collapsedHeight:200,heightMargin:16,moreLink:'<a href="#">Read More</a>',lessLink:'<a href="#">Close</a>',embedCSS:!0,blockCSS:"display: block; width: 100%;",startOpen:!1,blockProcessed:function(){},beforeToggle:function(){},afterToggle:function(){}},d={},h=0,c=e(function(){t("[data-readmore]").each(function(){var e=t(this),i="true"===e.attr("aria-expanded");o(e),e.css({height:e.data(i?"expandedHeight":"collapsedHeight")})})},100);a.prototype={init:function(){var e=t(this.element);e.data({defaultHeight:this.options.collapsedHeight,heightMargin:this.options.heightMargin}),o(e);var n=e.data("collapsedHeight"),a=e.data("heightMargin");if(e.outerHeight(!0)<=n+a)return this.options.blockProcessed&&"function"==typeof this.options.blockProcessed&&this.options.blockProcessed(e,!1),!0;var s=e.attr("id")||i(),r=this.options.startOpen?this.options.lessLink:this.options.moreLink;e.attr({"data-readmore":"","aria-expanded":this.options.startOpen,id:s}),e.after(t(r).on("click",function(t){return function(i){t.toggle(this,e[0],i)}}(this)).attr({"data-readmore-toggle":s,"aria-controls":s})),this.options.startOpen||e.css({height:n}),this.options.blockProcessed&&"function"==typeof this.options.blockProcessed&&this.options.blockProcessed(e,!0)},toggle:function(e,i,o){o&&o.preventDefault(),e||(e=t('[aria-controls="'+this.element.id+'"]')[0]),i||(i=this.element);var n=t(i),a="",s="",r=!1,d=n.data("collapsedHeight");n.height()<=d?(a=n.data("expandedHeight")+"px",s="lessLink",r=!0):(a=d,s="moreLink"),this.options.beforeToggle&&"function"==typeof this.options.beforeToggle&&this.options.beforeToggle(e,n,!r),n.css({height:a}),n.on("transitionend",function(i){return function(){i.options.afterToggle&&"function"==typeof i.options.afterToggle&&i.options.afterToggle(e,n,r),t(this).attr({"aria-expanded":r}).off("transitionend")}}(this)),t(e).replaceWith(t(this.options[s]).on("click",function(t){return function(e){t.toggle(this,i,e)}}(this)).attr({"data-readmore-toggle":n.attr("id"),"aria-controls":n.attr("id")}))},destroy:function(){t(this.element).each(function(){var e=t(this);e.attr({"data-readmore":null,"aria-expanded":null}).css({maxHeight:"",height:""}).next("[data-readmore-toggle]").remove(),e.removeData()})}},t.fn.readmore=function(e){var i=arguments,o=this.selector;return e=e||{},"object"==typeof e?this.each(function(){if(t.data(this,"plugin_"+s)){var i=t.data(this,"plugin_"+s);i.destroy.apply(i)}e.selector=o,t.data(this,"plugin_"+s,new a(this,e))}):"string"==typeof e&&"_"!==e[0]&&"init"!==e?this.each(function(){var o=t.data(this,"plugin_"+s);o instanceof a&&"function"==typeof o[e]&&o[e].apply(o,Array.prototype.slice.call(i,1))}):void 0}});;
/**
 * Copyright (c) 2007-2015 Ariel Flesler - aflesler<a>gmail<d>com | http://flesler.blogspot.com
 * Licensed under MIT
 * @author Ariel Flesler
 * @version 2.1.2
 */
;(function(f){"use strict";"function"===typeof define&&define.amd?define(["jquery"],f):"undefined"!==typeof module&&module.exports?module.exports=f(require("jquery")):f(jQuery)})(function($){"use strict";function n(a){return!a.nodeName||-1!==$.inArray(a.nodeName.toLowerCase(),["iframe","#document","html","body"])}function h(a){return $.isFunction(a)||$.isPlainObject(a)?a:{top:a,left:a}}var p=$.scrollTo=function(a,d,b){return $(window).scrollTo(a,d,b)};p.defaults={axis:"xy",duration:0,limit:!0};$.fn.scrollTo=function(a,d,b){"object"=== typeof d&&(b=d,d=0);"function"===typeof b&&(b={onAfter:b});"max"===a&&(a=9E9);b=$.extend({},p.defaults,b);d=d||b.duration;var u=b.queue&&1<b.axis.length;u&&(d/=2);b.offset=h(b.offset);b.over=h(b.over);return this.each(function(){function k(a){var k=$.extend({},b,{queue:!0,duration:d,complete:a&&function(){a.call(q,e,b)}});r.animate(f,k)}if(null!==a){var l=n(this),q=l?this.contentWindow||window:this,r=$(q),e=a,f={},t;switch(typeof e){case "number":case "string":if(/^([+-]=?)?\d+(\.\d+)?(px|%)?$/.test(e)){e= h(e);break}e=l?$(e):$(e,q);case "object":if(e.length===0)return;if(e.is||e.style)t=(e=$(e)).offset()}var v=$.isFunction(b.offset)&&b.offset(q,e)||b.offset;$.each(b.axis.split(""),function(a,c){var d="x"===c?"Left":"Top",m=d.toLowerCase(),g="scroll"+d,h=r[g](),n=p.max(q,c);t?(f[g]=t[m]+(l?0:h-r.offset()[m]),b.margin&&(f[g]-=parseInt(e.css("margin"+d),10)||0,f[g]-=parseInt(e.css("border"+d+"Width"),10)||0),f[g]+=v[m]||0,b.over[m]&&(f[g]+=e["x"===c?"width":"height"]()*b.over[m])):(d=e[m],f[g]=d.slice&& "%"===d.slice(-1)?parseFloat(d)/100*n:d);b.limit&&/^\d+$/.test(f[g])&&(f[g]=0>=f[g]?0:Math.min(f[g],n));!a&&1<b.axis.length&&(h===f[g]?f={}:u&&(k(b.onAfterFirst),f={}))});k(b.onAfter)}})};p.max=function(a,d){var b="x"===d?"Width":"Height",h="scroll"+b;if(!n(a))return a[h]-$(a)[b.toLowerCase()]();var b="client"+b,k=a.ownerDocument||a.document,l=k.documentElement,k=k.body;return Math.max(l[h],k[h])-Math.min(l[b],k[b])};$.Tween.propHooks.scrollLeft=$.Tween.propHooks.scrollTop={get:function(a){return $(a.elem)[a.prop]()}, set:function(a){var d=this.get(a);if(a.options.interrupt&&a._last&&a._last!==d)return $(a.elem).stop();var b=Math.round(a.now);d!==b&&($(a.elem)[a.prop](b),a._last=this.get(a))}};return p});;
/*
    Marmelo base theme for Drupal
    Copyright (C) 2017  Marmelo Ltd
 
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. 

    */
/**
 * @file canvas.js
 * Sets up a canvas in the background to draw blocks
 */


(function($) {

    $(document).ready(function() {


        var avoidWidth = document.getElementById('page-wrapper').clientWidth;
        var availableWidth = ((document.body.clientWidth - avoidWidth) / 2);

        if(availableWidth > 10) {
            var draw = new DecodeDrawer('background-canvas', 
                {   
                    debugMode: false, 
                    drawrects: [ {
                            x: 0,
                            y: 100,
                            w: Math.round(availableWidth - 70),
                            h: Math.round(document.body.clientHeight -100)
                        }, {
                            x: Math.round(availableWidth + avoidWidth + 70),
                            y: 100,
                            w: Math.round(availableWidth - 70),
                            h: Math.round(document.body.clientHeight - 100)
                        }]
                });
            draw.start();

        } else {

            console.log("We regret to inform you there is no space to draw sideblocks.");

        }



    });

})(jQuery);;
/*
    Marmelo base theme for Drupal
    Copyright (C) 2017  Marmelo Ltd
 
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. 

    */
/**
 * @file theme.js
 * Basic click handlers for hamburger and skip to
 */


(function($) {

    $(document).ready(function() {


        $('#skipto').on('change', function() {
            
            $(window).scrollTo($('#section_'+$('#skipto option:selected').attr('value')), { duration: 200 });

        });


        $('button.hamburger').on('click', function() {

            $('button.hamburger').toggleClass('is-active');
            $('nav').toggleClass('show');

        });


        
        $('.field-name-field-highlights').marmeloSlide('> .field-items', '.field-item', 1);

        $('body.node-type-event-sub-page .paragraphs-items-field-sections-sub-page .paragraphs-item-speaker .field-name-field-biog').readmore({
            collapsedHeight: 0
        });

        $('a[href*="#"]').on('click', function (e) {
            e.preventDefault();

            var id = $(this).attr('href');
            id = id.substring(1,id.length);

            console.log('*[name="'+id+'"]');
        
            $('html, body').animate({
                scrollTop: $('*[name="'+id+'"]').offset().top
            }, 500, 'linear');
        });

    });

})(jQuery);;
